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
    Download audio for a YouTube video ID.
    Returns (filepath, track_title, artist, extension)

    Waterfall:
      1. yt-dlp with tv_embedded + ios player clients (+ cookies/proxy if set)
      2. yt-dlp with web_embedded + android_music player clients (+ cookies/proxy if set)
      3. Invidious pool with chunked Range download
      4. Raise exception if all fail
    """
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    temp_dir    = tempfile.gettempdir()
    file_id     = str(uuid.uuid4())
    ffmpeg_exe  = imageio_ffmpeg.get_ffmpeg_exe()

    track_title, artist = _get_metadata(video_id)

    raw_filepath  = os.path.join(temp_dir, f"{file_id}.raw")
    flac_filepath = os.path.join(temp_dir, f"{file_id}.flac")
    downloaded    = False

    # Optional cookies file
    _cookies_exist = os.path.exists(COOKIES_PATH)

    # Optional residential proxy from env
    _ytdlp_proxy = os.environ.get("YTDLP_PROXY")

    def _make_ydl_opts(player_clients, http_headers=None):
        """Build yt-dlp options dict with optional cookies and proxy."""
        opts = {
            "format":         "bestaudio/best",
            "outtmpl":        os.path.join(temp_dir, f"{file_id}.%(ext)s"),
            "quiet":          True,
            "no_warnings":    True,
            "socket_timeout": 30,
            "extractor_args": {
                "youtube": {
                    "player_client": player_clients,
                }
            },
        }
        if http_headers:
            opts["http_headers"] = http_headers
        if _cookies_exist:
            opts.update(_get_cookie_opts())
        if _ytdlp_proxy:
            opts["proxy"] = _ytdlp_proxy
        return opts

    def _run_ydl(opts):
        """Run yt-dlp and return the output filepath, or None on failure."""
        with yt_dlp.YoutubeDL(opts) as ydl:
            info        = ydl.extract_info(youtube_url, download=True)
            actual_file = ydl.prepare_filename(info)
            if not os.path.exists(actual_file):
                for ext in (".webm", ".m4a", ".opus", ".mp4", ".ogg"):
                    candidate = os.path.splitext(actual_file)[0] + ext
                    if os.path.exists(candidate):
                        return candidate
                return None
            return actual_file

    # ── Method 1: yt-dlp — tv_embedded + ios ─────────────────────────────────
    print(f"\n[{video_id}] Trying yt-dlp (tv_embedded + ios)…")
    try:
        opts = _make_ydl_opts(
            player_clients=["tv_embedded", "ios"],
            http_headers={
                "User-Agent": "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X)",
            },
        )
        actual_file = _run_ydl(opts)
        if actual_file and os.path.exists(actual_file):
            os.rename(actual_file, raw_filepath)
            downloaded = True
            print("✅ yt-dlp tv_embedded+ios: success")
    except Exception as e:
        print(f"yt-dlp tv_embedded+ios failed: {e}")

    # ── Method 2: yt-dlp — web_embedded + android_music ──────────────────────
    if not downloaded:
        print(f"[{video_id}] Trying yt-dlp (web_embedded + android_music)…")
        try:
            opts = _make_ydl_opts(
                player_clients=["web_embedded", "android_music"],
            )
            actual_file = _run_ydl(opts)
            if actual_file and os.path.exists(actual_file):
                os.rename(actual_file, raw_filepath)
                downloaded = True
                print("✅ yt-dlp web_embedded+android_music: success")
        except Exception as e:
            print(f"yt-dlp web_embedded+android_music failed: {e}")

    # ── Method 3: Invidious pool — 10 s timeout, skip non-200, highest bitrate
    if not downloaded:
        print(f"[{video_id}] Trying Invidious pool…")
        audio_url = None
        for instance in INVIDIOUS_INSTANCES:
            try:
                api_url = f"{instance}/api/v1/videos/{video_id}?fields=adaptiveFormats"
                resp    = requests.get(
                    api_url,
                    timeout=10,
                    headers={"User-Agent": random.choice(_USER_AGENTS)},
                )
                if resp.status_code != 200:
                    print(f"  Invidious {instance}: HTTP {resp.status_code}, skipping")
                    continue
                best, best_br = None, 0
                for fmt in resp.json().get("adaptiveFormats", []):
                    if fmt.get("type", "").startswith("audio/") and fmt.get("url"):
                        br = int(fmt.get("bitrate", 0))
                        if br > best_br:
                            best_br, best = br, fmt
                if best:
                    audio_url = best["url"]
                    print(f"  Invidious: got URL from {instance} @ {best_br} bps")
                    break
                else:
                    print(f"  Invidious {instance}: no audio formats found, skipping")
            except Exception as e:
                print(f"  Invidious {instance}: {e}, skipping")

        if audio_url:
            if _chunked_range_download(audio_url, raw_filepath):
                downloaded = True
                print("✅ Invidious chunked: success")

    if not downloaded:
        raise Exception(
            "All download methods failed (yt-dlp tv_embedded+ios, web_embedded+android_music, Invidious). "
            "Try again later or set YTDLP_PROXY to a residential proxy."
        )

    # Convert raw → FLAC
    try:
        subprocess.run(
            [ffmpeg_exe, "-y", "-i", raw_filepath, "-c:a", "flac", flac_filepath],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
    except subprocess.CalledProcessError as e:
        raise Exception(f"ffmpeg FLAC conversion failed: {e}")
    finally:
        try:
            os.remove(raw_filepath)
        except Exception:
            pass

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


@app.route("/api/download", methods=["POST"])
def download():
    data       = request.json or {}
    spotify_id = data.get("spotify_id")
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
            title = track_info.get('title', '')
            artists = track_info.get('artists', [{'name': ''}])[0].get('name', '')
            if title and artists:
                res = requests.get("https://lrclib.net/api/get", params={"track_name": title, "artist_name": artists}, headers={"User-Agent": "SpotiFLAC"}, timeout=5)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("syncedLyrics"):
                        return jsonify({"lyrics": data["syncedLyrics"], "synced": True})
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
