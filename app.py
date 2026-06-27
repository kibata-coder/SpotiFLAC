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
# Core downloader: freyr → .m4a → ffmpeg → .flac
# ─────────────────────────────────────────────────────────────────────────────
def download_audio(video_id: str, job_id: str = None):
    """
    Pipeline:
      1. iTunes search API  → Apple Music URL  (no API key needed)
      2. freyr get <url>    → downloads .m4a   (installed globally in Docker)
      3. ffmpeg             → converts to .flac (via imageio_ffmpeg)
    Returns (flac_filepath, track_title, artist)
    """
    temp_dir   = tempfile.gettempdir()
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    track_title, artist = _get_metadata(video_id)

    # Strip junk from title so iTunes search is accurate
    clean_title = re.sub(r'[\(\[].*?[\)\]]', '', track_title).strip()
    print(f"\n[{video_id}] freyr pipeline: {clean_title} — {artist}")

    # ── Step 1: Find Apple Music URL via iTunes public search API ─────────────
    if job_id:
        _update_job(job_id, stage="Searching Apple Music…", pct=5)

    apple_music_url = None
    try:
        resp = requests.get(
            "https://itunes.apple.com/search",
            params={"term": f"{clean_title} {artist}", "media": "music", "entity": "song", "limit": "1"},
            timeout=10,
        )
        results = resp.json().get("results", [])
        if results:
            apple_music_url = results[0].get("trackViewUrl")
            print(f"  ✅ Apple Music URL: {apple_music_url}")
    except Exception as e:
        print(f"  iTunes search error: {e}")

    if not apple_music_url:
        err = f"Could not find '{clean_title}' on Apple Music via iTunes search."
        if job_id:
            _update_job(job_id, done=True, error=err, stage="Failed")
        raise Exception(err)

    # ── Step 2: freyr downloads the .m4a ──────────────────────────────────────
    if job_id:
        _update_job(job_id, stage="freyr downloading…", pct=15)

    unique_dir = os.path.join(temp_dir, str(uuid.uuid4()))
    os.makedirs(unique_dir, exist_ok=True)

    print(f"  Running: freyr get {apple_music_url}")
    try:
        result = subprocess.run(
            ["freyr", "get", apple_music_url, "-d", unique_dir],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=300,
        )
        if result.returncode != 0:
            err_out = result.stderr.decode(errors="ignore")[-400:]
            raise Exception(f"freyr exited {result.returncode}: {err_out}")
    except FileNotFoundError:
        err = "freyr not found on server. Check that 'npm install -g freyr' ran during Docker build."
        if job_id:
            _update_job(job_id, done=True, error=err, stage="Failed")
        raise Exception(err)
    except subprocess.TimeoutExpired:
        err = "freyr timed out after 5 minutes."
        if job_id:
            _update_job(job_id, done=True, error=err, stage="Failed")
        raise Exception(err)

    # ── Step 3: Locate the .m4a freyr produced ────────────────────────────────
    m4a_file = None
    for root, _, files in os.walk(unique_dir):
        for f in files:
            if f.endswith(".m4a"):
                m4a_file = os.path.join(root, f)
                break
        if m4a_file:
            break

    if not m4a_file:
        out = result.stdout.decode(errors="ignore")[-600:]
        err = f"freyr ran but no .m4a found in output dir.\nfreyr stdout: {out}"
        if job_id:
            _update_job(job_id, done=True, error=err, stage="Failed")
        raise Exception(err)

    print(f"  ✅ freyr produced: {m4a_file}")

    # ── Step 4: ffmpeg .m4a → .flac ───────────────────────────────────────────
    if job_id:
        _update_job(job_id, stage="Converting to FLAC…", pct=82)

    file_id   = str(uuid.uuid4())
    flac_path = os.path.join(temp_dir, f"{file_id}.flac")

    try:
        conv = subprocess.run(
            [ffmpeg_exe, "-y", "-i", m4a_file, "-c:a", "flac", "-compression_level", "5", flac_path],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        if conv.returncode != 0:
            raise Exception(conv.stderr.decode(errors="ignore")[-300:])
    finally:
        shutil.rmtree(unique_dir, ignore_errors=True)

    if not os.path.exists(flac_path):
        raise Exception("FLAC file not found after ffmpeg conversion.")

    safe_name = re.sub(r'[\\/*?:"<>|]', "", f"{track_title} - {artist}")
    print(f"  ✅ FLAC ready: {flac_path}")

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
