from flask import Flask, request, jsonify, send_file, render_template
from ytmusicapi import YTMusic
import os
import tempfile
import uuid
import subprocess
import requests
import json
import urllib.request
import random
import time
from flask_cors import CORS
import re

COOKIES_PATH = "/app/cookies.txt"

def _get_cookie_opts():
    """Return cookiefile opt if cookies.txt exists, else empty dict."""
    if os.path.exists(COOKIES_PATH):
        print(f"🍪 Using cookies from {COOKIES_PATH}")
        return {"cookiefile": COOKIES_PATH}
    print("⚠️ No cookies.txt found, proceeding without cookies")
    return {}

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────────────────────────────────────
# YTMusic (search only)
# ─────────────────────────────────────────────────────────────────────────────
try:
    ytmusic = YTMusic()
except Exception as e:
    print(f"Warning: YTMusic init failed: {e}")
    ytmusic = None

# ─────────────────────────────────────────────────────────────────────────────
# Invidious pool & chunked download helpers
# ─────────────────────────────────────────────────────────────────────────────
INVIDIOUS_INSTANCES = [
    "https://inv.nadeko.net",
    "https://invidious.privacydev.net",
    "https://invidious.nerdvpn.de",
    "https://iv.melmac.space",
    "https://invidious.io.lol",
    "https://invidious.jing.rocks",
    "https://invidious.projectsegfau.lt",
    "https://invidious.fdn.fr",
    "https://yt.artemislena.eu",
    "https://invidious.lunar.icu",
    "https://invidious.tiekoetter.com",
]

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
]
CHUNK_SIZE = 512 * 1024  # 512 KB


def _chunked_range_download(url: str, dest_path: str) -> bool:
    """Download via HTTP Range requests in chunks (bot-evasion)."""
    sess = requests.Session()
    sess.headers.update({"User-Agent": random.choice(_USER_AGENTS)})
    try:
        head       = sess.head(url, timeout=15, allow_redirects=True)
        total_size = int(head.headers.get("Content-Length", 0))
    except Exception:
        total_size = 0

    offset, bytes_written = 0, 0
    with open(dest_path, "wb") as f:
        while True:
            headers = {
                "User-Agent": random.choice(_USER_AGENTS),
                "Range":      f"bytes={offset}-{offset + CHUNK_SIZE - 1}",
                "Referer":    "https://www.youtube.com/",
            }
            try:
                resp = sess.get(url, headers=headers, timeout=30, stream=True)
                if resp.status_code not in (200, 206):
                    break
                chunk = resp.content
                if not chunk:
                    break
                f.write(chunk)
                bytes_written += len(chunk)
                offset        += len(chunk)
                if total_size and offset >= total_size:
                    break
                if len(chunk) < CHUNK_SIZE:
                    break
            except Exception as e:
                print(f"  Chunk error at {offset}: {e}")
                break
            time.sleep(random.uniform(0.05, 0.4))

    return bytes_written > 0


# ─────────────────────────────────────────────────────────────────────────────
# Master audio download
# ─────────────────────────────────────────────────────────────────────────────
import yt_dlp
import imageio_ffmpeg


def _get_metadata(video_id: str):
    """Get track title + artist from YouTube oEmbed."""
    try:
        url  = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        with urllib.request.urlopen(url, timeout=8) as r:
            meta = json.loads(r.read())
        return meta.get("title", "Unknown Track"), meta.get("author_name", "Unknown Artist")
    except Exception:
        return "Unknown Track", "Unknown Artist"


def download_audio(video_id: str):
    """
    Download audio via freyr (Apple Music source) then convert to FLAC with ffmpeg.
    Pipeline: iTunes search → Apple Music URL → freyr (.m4a) → ffmpeg (.flac)
    Returns (filepath, track_title, artist, extension)
    """
    temp_dir = tempfile.gettempdir()
    track_title, artist = _get_metadata(video_id)
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    print(f"\n[{video_id}] Searching iTunes for: {track_title} - {artist}")

    # ── Step 1: Find Apple Music URL via iTunes public search API ─────────────
    apple_music_url = None
    try:
        search_query = f"{track_title} {artist}"
        itunes_resp = requests.get(
            "https://itunes.apple.com/search",
            params={"term": search_query, "media": "music", "entity": "song", "limit": "1"},
            timeout=10,
        )
        results = itunes_resp.json().get("results", [])
        if results:
            apple_music_url = results[0].get("trackViewUrl")
            print(f"  ✅ Found Apple Music URL: {apple_music_url}")
    except Exception as e:
        print(f"  iTunes search failed: {e}")

    if not apple_music_url:
        raise Exception("Could not find track on Apple Music via iTunes search.")

    # ── Step 2: Run freyr to download the .m4a ────────────────────────────────
    unique_dir = os.path.join(temp_dir, str(uuid.uuid4()))
    os.makedirs(unique_dir, exist_ok=True)

    print(f"  Running freyr on: {apple_music_url}")
    try:
        subprocess.run(
            ["freyr", "get", apple_music_url, "-d", unique_dir],
            check=True,
            timeout=300,  # 5 minute timeout
        )
    except FileNotFoundError:
        raise Exception("freyr not found. Ensure it is installed via 'npm install -g freyr'.")
    except subprocess.CalledProcessError as e:
        raise Exception(f"freyr download failed: {e}")
    except subprocess.TimeoutExpired:
        raise Exception("freyr download timed out after 5 minutes.")

    # ── Step 3: Find the downloaded .m4a file ────────────────────────────────
    m4a_file = None
    for root, _, files in os.walk(unique_dir):
        for f in files:
            if f.endswith(".m4a"):
                m4a_file = os.path.join(root, f)
                break
        if m4a_file:
            break

    if not m4a_file:
        raise Exception("freyr completed but no .m4a file found in output directory.")

    print(f"  ✅ freyr downloaded: {m4a_file}")

    # ── Step 4: Convert .m4a → .flac with ffmpeg ─────────────────────────────
    file_id = str(uuid.uuid4())
    flac_filepath = os.path.join(temp_dir, f"{file_id}.flac")

    try:
        subprocess.run(
            [ffmpeg_exe, "-y", "-i", m4a_file, "-c:a", "flac", "-compression_level", "8", flac_filepath],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError as e:
        raise Exception(f"ffmpeg FLAC conversion failed: {e}")

    # Clean up the m4a temp dir
    try:
        import shutil
        shutil.rmtree(unique_dir, ignore_errors=True)
    except Exception:
        pass

    if not os.path.exists(flac_filepath):
        raise Exception("FLAC file not found after conversion.")

    print(f"  ✅ FLAC ready: {flac_filepath}")
    return flac_filepath, track_title, artist, "flac"



# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/search", methods=["POST"])
def search():
    data  = request.json or {}
    query = data.get("query")
    limit = int(data.get("limit", 20))

    if not query:
        return jsonify({"error": "Missing query"}), 400
    if not ytmusic:
        return jsonify({"error": "YTMusic not configured"}), 500

    try:
        results = ytmusic.search(query=query, filter="songs", limit=limit)
        tracks  = []
        for track in results:
            if track.get("resultType") != "song":
                continue
            thumbnails  = track.get("thumbnails", [])
            image_url   = thumbnails[-1]["url"] if thumbnails else ""
            artists_str = ", ".join(a["name"] for a in track.get("artists", [])) or "Unknown Artist"
            album       = track.get("album")
            tracks.append({
                "id":      track["videoId"],
                "name":    track["title"],
                "artists": artists_str,
                "album":   album["name"] if album else "Unknown Album",
                "cover":   image_url,
            })
        return jsonify(tracks)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/download", methods=["POST", "GET"])
def download():
    if request.method == "POST":
        data = request.json or {}
        spotify_id = data.get("spotify_id")
    else:
        spotify_id = request.args.get("spotify_id")
        
    if not spotify_id:
        return jsonify({"error": "Missing spotify_id"}), 400
    try:
        filepath, title, artist, ext = download_audio(spotify_id)
        return send_file(
            filepath,
            as_attachment=True,
            download_name=f"{title} - {artist}.{ext}",
            mimetype=f"audio/{ext}",
        )
    except Exception as e:
        print(f"Download error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/stream", methods=["GET"])
def stream():
    spotify_id = request.args.get("spotify_id")
    if not spotify_id:
        return jsonify({"error": "Missing spotify_id"}), 400
    try:
        filepath, title, artist, ext = download_audio(spotify_id)
        return send_file(filepath, as_attachment=False, mimetype=f"audio/{ext}")
    except Exception as e:
        print(f"Stream error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/cookies/status", methods=["GET"])
def cookies_status():
    exists = os.path.exists(COOKIES_PATH)
    return jsonify({
        "cookies_loaded": exists,
        "path": COOKIES_PATH,
        "message": "cookies.txt found and active" if exists else "No cookies.txt found — uploads bypassed"
    })


@app.route("/api/cookies/upload", methods=["POST"])
def cookies_upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    if not file.filename.endswith(".txt"):
        return jsonify({"error": "File must be a .txt file"}), 400
    try:
        os.makedirs(os.path.dirname(COOKIES_PATH), exist_ok=True)
        file.save(COOKIES_PATH)
        return jsonify({"success": True, "message": "cookies.txt uploaded successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/lyrics", methods=["GET"])
def get_lyrics():
    spotify_id = request.args.get("spotify_id")
    if not spotify_id:
        return jsonify({"error": "Missing spotify_id"}), 400
    if not ytmusic:
        return jsonify({"error": "YTMusic not configured"}), 500
    
    try:
        watch = ytmusic.get_watch_playlist(videoId=spotify_id)
        
        try:
            track_info = watch.get('tracks', [{}])[0]
            raw_title = track_info.get('title', '')
            title = re.sub(r'[\(\[].*?[\)\]]', '', raw_title).strip()
            artists = track_info.get('artists', [{'name': ''}])[0].get('name', '')
            if title and artists:
                res = requests.get("https://lrclib.net/api/get", params={"track_name": title, "artist_name": artists}, headers={"User-Agent": "SpotiFLAC"}, timeout=5)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("syncedLyrics"):
                        return jsonify({"lyrics": data["syncedLyrics"], "synced": True})
                
                # Fallback: search lrclib
                search_res = requests.get("https://lrclib.net/api/search", params={"q": f"{title} {artists}"}, headers={"User-Agent": "SpotiFLAC"}, timeout=5)
                if search_res.status_code == 200:
                    results = search_res.json()
                    for r in results:
                        if r.get("syncedLyrics"):
                            return jsonify({"lyrics": r["syncedLyrics"], "synced": True})
        except Exception as e:
            print(f"LRCLIB error: {e}")

        lyrics_id = watch.get("lyrics")
        if not lyrics_id:
            return jsonify({"error": "Lyrics not available for this track"}), 404
            
        lyrics_data = ytmusic.get_lyrics(lyrics_id)
        return jsonify({"lyrics": lyrics_data.get("lyrics", ""), "synced": False})
    except Exception as e:
        print(f"Lyrics error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
