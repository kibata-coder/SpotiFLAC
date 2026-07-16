from flask import Flask, request, jsonify, send_file, render_template, Response
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
import re
import threading
import yt_dlp
import imageio_ffmpeg

from flask_cors import CORS

COOKIES_PATH = "/app/cookies.txt"

app = Flask(__name__)
CORS(app, resources={r"/api/*": {
    "origins": [
        "https://soudmusic.pages.dev",
        "https://web-production-9dcae.up.railway.app",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
    ],
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type"],
}})

# ─────────────────────────────────────────────────────────────────────────────
# YTMusic client (search + lyrics)
# ─────────────────────────────────────────────────────────────────────────────
try:
    ytmusic = YTMusic()
except Exception as e:
    print(f"Warning: YTMusic init failed: {e}")
    ytmusic = None

# ─────────────────────────────────────────────────────────────────────────────
# Download job registry  (job_id → progress dict, stored in-process memory)
# ─────────────────────────────────────────────────────────────────────────────
_download_jobs: dict = {}
_jobs_lock = threading.Lock()

def _new_job(job_id: str):
    with _jobs_lock:
        _download_jobs[job_id] = {
            "stage": "queued", "pct": 0,
            "done": False, "error": None,
            "filepath": None, "filename": None,
        }

def _update_job(job_id: str, **kwargs):
    with _jobs_lock:
        if job_id in _download_jobs:
            _download_jobs[job_id].update(kwargs)

def _get_job(job_id: str) -> dict:
    with _jobs_lock:
        return dict(_download_jobs.get(job_id, {}))

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _get_metadata(video_id: str):
    """Get track title + artist from YouTube oEmbed (fast, no API key needed)."""
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        with urllib.request.urlopen(url, timeout=8) as r:
            meta = json.loads(r.read())
        return meta.get("title", "Unknown Track"), meta.get("author_name", "Unknown Artist")
    except Exception:
        return "Unknown Track", "Unknown Artist"

# ─────────────────────────────────────────────────────────────────────────────
# Downloader: yt_dlp → .m4a  (simple, proven working)
# ─────────────────────────────────────────────────────────────────────────────
def download_audio(video_id: str):
    """
    Download best audio and convert to mp3 using yt_dlp.
    Returns (filepath, track_title, artist, ext)
    """
    temp_dir    = tempfile.gettempdir()
    file_id     = str(uuid.uuid4())
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    track_title, artist = _get_metadata(video_id)

    ydl_opts = {
        "format":       "bestaudio/best",
        "ffmpeg_location": imageio_ffmpeg.get_ffmpeg_exe(),
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
        "outtmpl":      os.path.join(temp_dir, f"{file_id}.%(ext)s"),
        "quiet":        True,
        "no_warnings":  True,
        **({
            "cookiefile": COOKIES_PATH
        } if os.path.exists(COOKIES_PATH) else {}),
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info       = ydl.extract_info(youtube_url, download=True)
        downloaded = ydl.prepare_filename(info)

    # Locate the actual file yt_dlp wrote
    if not os.path.exists(downloaded):
        for ext in (".mp3", ".m4a", ".webm", ".opus", ".ogg", ".mp4"):
            candidate = os.path.splitext(downloaded)[0] + ext
            if os.path.exists(candidate):
                downloaded = candidate
                break

    if not os.path.exists(downloaded):
        raise Exception("yt_dlp finished but output file not found.")

    _, ext = os.path.splitext(downloaded)
    print(f"  ✅ Downloaded: {downloaded}")
    return downloaded, track_title, artist, ext.lstrip(".")


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
    search_type = data.get("search_type", "track")

    if not query:
        return jsonify({"error": "Missing query"}), 400
    if not ytmusic:
        return jsonify({"error": "YTMusic not configured"}), 500

    try:
        yt_filter = "songs" if search_type == "track" else "albums"
        results = ytmusic.search(query=query, filter=yt_filter, limit=limit)
        tracks  = []
        for track in results:
            if search_type == "track" and track.get("resultType") != "song":
                continue
            if search_type == "album" and track.get("resultType") != "album":
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


@app.route("/api/download", methods=["GET"])
def download():
    spotify_id = request.args.get("spotify_id")
    if not spotify_id:
        return jsonify({"error": "Missing spotify_id"}), 400
    try:
        filepath, title, artist, ext = download_audio(spotify_id)
        safe_name = re.sub(r'[\\/*?:"<>|]', "", f"{title} - {artist}")
        return send_file(
            filepath,
            as_attachment=True,
            download_name=f"{safe_name}.{ext}",
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
            track_info = watch.get("tracks", [{}])[0]
            raw_title  = track_info.get("title", "")
            title      = re.sub(r"[\(\[].*?[\)\]]", "", raw_title).strip()
            artists    = track_info.get("artists", [{"name": ""}])[0].get("name", "")
            if title and artists:
                # Try exact match first
                res = requests.get(
                    "https://lrclib.net/api/get",
                    params={"track_name": title, "artist_name": artists},
                    headers={"User-Agent": "SpotiFLAC"}, timeout=5,
                )
                if res.status_code == 200 and res.json().get("syncedLyrics"):
                    return jsonify({"lyrics": res.json()["syncedLyrics"], "synced": True})

                # Fuzzy search fallback
                search_res = requests.get(
                    "https://lrclib.net/api/search",
                    params={"q": f"{title} {artists}"},
                    headers={"User-Agent": "SpotiFLAC"}, timeout=5,
                )
                if search_res.status_code == 200:
                    for r in search_res.json():
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
