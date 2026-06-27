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
CORS(app)

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
# Core downloader: yt_dlp (Python lib) → raw audio → ffmpeg → FLAC
# ─────────────────────────────────────────────────────────────────────────────
def download_audio(video_id: str, job_id: str = None):
    """
    Download best audio with yt_dlp then convert to FLAC with imageio_ffmpeg.
    Progress is reported to job_id if provided.
    Returns (flac_filepath, track_title, artist)
    """
    temp_dir = tempfile.gettempdir()
    track_title, artist = _get_metadata(video_id)
    file_id = str(uuid.uuid4())
    raw_path  = os.path.join(temp_dir, f"{file_id}.raw")
    flac_path = os.path.join(temp_dir, f"{file_id}.flac")
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"

    print(f"\n[{video_id}] Downloading: {track_title} — {artist}")

    def _progress_hook(d):
        if not job_id:
            return
        status = d.get("status")
        if status == "downloading":
            total   = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            current = d.get("downloaded_bytes", 0)
            # Scale download to 0-70% of total progress
            pct = int((current / total) * 70) if total else 5
            _update_job(job_id, stage="Downloading audio…", pct=max(5, pct))
        elif status == "finished":
            _update_job(job_id, stage="Converting to FLAC…", pct=75)

    if job_id:
        _update_job(job_id, stage="Connecting…", pct=2)

    # ── Step 1: Download raw audio via yt_dlp ─────────────────────────────────
    ydl_opts = {
        "format":         "bestaudio/best",
        "outtmpl":        os.path.join(temp_dir, f"{file_id}.%(ext)s"),
        "quiet":          True,
        "no_warnings":    True,
        "progress_hooks": [_progress_hook],
        # Pass cookies.txt if it exists — hugely helps with bot detection
        **({"cookiefile": COOKIES_PATH} if os.path.exists(COOKIES_PATH) else {}),
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            downloaded = ydl.prepare_filename(info)

        # yt_dlp writes the real extension — find the actual file
        if not os.path.exists(downloaded):
            for ext in (".webm", ".m4a", ".opus", ".ogg", ".mp4"):
                candidate = os.path.splitext(downloaded)[0] + ext
                if os.path.exists(candidate):
                    downloaded = candidate
                    break

        if not os.path.exists(downloaded):
            raise Exception("yt_dlp finished but could not locate output file.")

        os.rename(downloaded, raw_path)
        print(f"  ✅ yt_dlp downloaded raw audio → {raw_path}")

    except Exception as e:
        if job_id:
            _update_job(job_id, done=True, error=str(e))
        raise Exception(f"yt_dlp failed: {e}")

    # ── Step 2: ffmpeg raw → FLAC ─────────────────────────────────────────────
    if job_id:
        _update_job(job_id, stage="Converting to FLAC…", pct=78)

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    try:
        result = subprocess.run(
            [ffmpeg_exe, "-y", "-i", raw_path, "-c:a", "flac", "-compression_level", "5", flac_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if result.returncode != 0:
            err = result.stderr.decode(errors="ignore")[-500:]
            raise Exception(f"ffmpeg error: {err}")
    finally:
        try:
            os.remove(raw_path)
        except Exception:
            pass

    if not os.path.exists(flac_path):
        raise Exception("FLAC file not found after conversion.")

    safe_name = re.sub(r'[\\/*?:"<>|]', "", f"{track_title} - {artist}")
    print(f"  ✅ FLAC ready → {flac_path}")

    if job_id:
        _update_job(job_id, stage="Ready!", pct=100, done=True,
                    filepath=flac_path, filename=f"{safe_name}.flac")

    return flac_path, track_title, artist

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


# ── Download: start a background job, return job_id immediately ──────────────
@app.route("/api/download/start", methods=["POST"])
def download_start():
    data = request.json or {}
    spotify_id = data.get("spotify_id")
    if not spotify_id:
        return jsonify({"error": "Missing spotify_id"}), 400

    job_id = str(uuid.uuid4())
    _new_job(job_id)

    def _worker():
        try:
            flac_path, title, artist = download_audio(spotify_id, job_id=job_id)
        except Exception as e:
            _update_job(job_id, done=True, error=str(e), stage="Failed")

    t = threading.Thread(target=_worker, daemon=True)
    t.start()

    return jsonify({"job_id": job_id})


# ── Poll progress ─────────────────────────────────────────────────────────────
@app.route("/api/download/progress/<job_id>", methods=["GET"])
def download_progress(job_id):
    job = _get_job(job_id)
    if not job:
        return jsonify({"error": "Unknown job"}), 404
    return jsonify(job)


# ── Serve the finished file ───────────────────────────────────────────────────
@app.route("/api/download/file/<job_id>", methods=["GET"])
def download_file(job_id):
    job = _get_job(job_id)
    if not job:
        return jsonify({"error": "Unknown job"}), 404
    if not job.get("done") or job.get("error"):
        return jsonify({"error": job.get("error", "Not ready")}), 400

    filepath = job.get("filepath")
    filename = job.get("filename", "track.flac")

    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "File not found on server"}), 404

    return send_file(
        filepath,
        as_attachment=True,
        download_name=filename,
        mimetype="audio/flac",
    )


@app.route("/api/stream", methods=["GET"])
def stream():
    spotify_id = request.args.get("spotify_id")
    if not spotify_id:
        return jsonify({"error": "Missing spotify_id"}), 400
    try:
        flac_path, title, artist = download_audio(spotify_id)
        return send_file(flac_path, as_attachment=False, mimetype="audio/flac")
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
