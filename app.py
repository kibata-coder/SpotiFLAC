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
import threading
from flask_cors import CORS

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
# TIDAL credentials
# ─────────────────────────────────────────────────────────────────────────────
TIDAL_CLIENT_ID     = os.environ.get("TIDAL_CLIENT_ID",     "dR7zD87eGc6eL8Mc")
TIDAL_CLIENT_SECRET = os.environ.get("TIDAL_CLIENT_SECRET", "kE6E3pzt8dzXB70IyfBZVSnHmtVRl3xisXei2aWfg0g=")

# Railway env vars for persisting token across restarts
# Set these from the /api/tidal/token response after first login
TIDAL_ACCESS_TOKEN  = os.environ.get("TIDAL_ACCESS_TOKEN")
TIDAL_REFRESH_TOKEN = os.environ.get("TIDAL_REFRESH_TOKEN")
TIDAL_TOKEN_TYPE    = os.environ.get("TIDAL_TOKEN_TYPE", "Bearer")
TIDAL_EXPIRY_TIME   = os.environ.get("TIDAL_EXPIRY_TIME")

# Also support a JSON blob in a single env var (convenient for Railway)
# Set TIDAL_TOKEN_JSON to the full JSON from /api/tidal/token
_TIDAL_TOKEN_JSON = os.environ.get("TIDAL_TOKEN_JSON")

# Fallback: token file (survives within same process/deployment)
TIDAL_TOKEN_FILE = os.path.join(tempfile.gettempdir(), "tidal_oauth.json")

# ─────────────────────────────────────────────────────────────────────────────
# TIDAL Session management
# ─────────────────────────────────────────────────────────────────────────────
_tidal_session      = None
_tidal_session_lock = threading.Lock()
_tidal_login_data   = None   # Stores pending device-code login info


def _get_tidalapi():
    """Import tidalapi safely."""
    try:
        import tidalapi
        return tidalapi
    except ImportError:
        return None


def _make_tidal_config(tidalapi):
    """Create a tidalapi Config with our credentials."""
    config = tidalapi.Config(quality=tidalapi.Quality.lossless)
    config.client_id     = TIDAL_CLIENT_ID
    config.client_secret = TIDAL_CLIENT_SECRET
    return config


def _save_tidal_token(session):
    """Persist the TIDAL token to the temp file."""
    try:
        expiry = session.expiry_time
        if expiry and hasattr(expiry, "isoformat"):
            expiry = expiry.isoformat()
        elif expiry:
            expiry = str(expiry)
        data = {
            "token_type":    session.token_type    or "Bearer",
            "access_token":  session.access_token,
            "refresh_token": session.refresh_token,
            "expiry_time":   expiry,
        }
        with open(TIDAL_TOKEN_FILE, "w") as f:
            json.dump(data, f)
        print(f"💾 TIDAL token saved to {TIDAL_TOKEN_FILE}")
        return data
    except Exception as e:
        print(f"Warning: could not save TIDAL token: {e}")
        return None


def _load_tidal_session():
    """
    Return an authenticated tidalapi.Session.
    Priority order:
      1. Already-loaded singleton
      2. TIDAL_TOKEN_JSON env var (Railway persistent storage)
      3. Individual env vars (TIDAL_ACCESS_TOKEN etc.)
      4. Token file on disk (/tmp/tidal_oauth.json)
      5. Wait (session needs device-code login first)
    """
    global _tidal_session

    with _tidal_session_lock:
        # Already have a live session?
        if _tidal_session is not None:
            try:
                if _tidal_session.check_login():
                    return _tidal_session
            except Exception:
                pass

        tidalapi = _get_tidalapi()
        if not tidalapi:
            print("tidalapi not installed")
            return None

        config  = _make_tidal_config(tidalapi)
        session = tidalapi.Session(config)

        # Try loading from various sources
        token_data = None

        # Source 1: TIDAL_TOKEN_JSON env var
        if _TIDAL_TOKEN_JSON:
            try:
                token_data = json.loads(_TIDAL_TOKEN_JSON)
                print("🔑 TIDAL: loading token from TIDAL_TOKEN_JSON env var")
            except Exception as e:
                print(f"TIDAL_TOKEN_JSON parse error: {e}")

        # Source 2: Individual env vars
        if not token_data and TIDAL_ACCESS_TOKEN:
            token_data = {
                "token_type":    TIDAL_TOKEN_TYPE  or "Bearer",
                "access_token":  TIDAL_ACCESS_TOKEN,
                "refresh_token": TIDAL_REFRESH_TOKEN,
                "expiry_time":   TIDAL_EXPIRY_TIME,
            }
            print("🔑 TIDAL: loading token from env vars")

        # Source 3: Token file
        if not token_data and os.path.exists(TIDAL_TOKEN_FILE):
            try:
                with open(TIDAL_TOKEN_FILE) as f:
                    token_data = json.load(f)
                print(f"🔑 TIDAL: loading token from {TIDAL_TOKEN_FILE}")
            except Exception as e:
                print(f"Token file read error: {e}")

        # Try to load the token into a session
        if token_data:
            try:
                session.load_oauth_session(
                    token_type    = token_data.get("token_type",    "Bearer"),
                    access_token  = token_data.get("access_token",  ""),
                    refresh_token = token_data.get("refresh_token"),
                    expiry_time   = token_data.get("expiry_time"),
                )
                if session.check_login():
                    print("✅ TIDAL: session active")
                    _tidal_session = session
                    # Refresh saved token in case it was refreshed
                    _save_tidal_token(session)
                    return session
                else:
                    print("⚠️  TIDAL: loaded token is invalid/expired")
            except Exception as e:
                print(f"TIDAL session load error: {e}")

        print("❌ TIDAL: no valid session. Use /api/tidal/login to authenticate.")
        return None


# Pre-warm TIDAL session at startup
def _startup_tidal():
    time.sleep(2)  # give Flask a moment to start
    _load_tidal_session()

threading.Thread(target=_startup_tidal, daemon=True).start()


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
                    if bytes_written == 0 and resp.status_code == 200:
                        for data in resp.iter_content(CHUNK_SIZE):
                            f.write(data)
                            bytes_written += len(data)
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
# TIDAL Download
# ─────────────────────────────────────────────────────────────────────────────
def _download_via_tidal(track_title: str, artist: str, dest_path: str) -> bool:
    """
    Search TIDAL for the track, get the stream URL, download to dest_path.
    Returns True on success.
    """
    session = _load_tidal_session()
    if not session:
        return False

    tidalapi = _get_tidalapi()
    if not tidalapi:
        return False

    try:
        query   = f"{track_title} {artist}".strip()
        results = session.search(query, models=[tidalapi.Track], limit=5)
        tracks  = results.get("tracks", [])
        if not tracks:
            print(f"TIDAL: no results for '{query}'")
            return False

        tidal_track = tracks[0]
        print(f"TIDAL: matched → '{tidal_track.name}' by {tidal_track.artist.name}")

        # get_url() returns either a string URL or raises on failure
        stream_url = tidal_track.get_url()
        print(f"TIDAL: got stream URL: {str(stream_url)[:80]}…")

        # Download with Authorization header
        dl_sess = requests.Session()
        dl_sess.headers.update({
            "User-Agent":    "TIDAL/3.18.8 (Android; 5.1)",
            "Authorization": f"Bearer {session.access_token}",
        })
        with dl_sess.get(stream_url, stream=True, timeout=120) as resp:
            resp.raise_for_status()
            with open(dest_path, "wb") as f:
                for chunk in resp.iter_content(65536):
                    if chunk:
                        f.write(chunk)

        size = os.path.getsize(dest_path)
        if size > 10_000:  # > 10 KB = valid audio
            print(f"✅ TIDAL: downloaded {size // 1024} KB")
            return True

        print(f"TIDAL: file too small ({size} bytes), treating as failure")
        return False

    except Exception as e:
        print(f"TIDAL download error: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Master audio download (tries all methods in order)
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
    """
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    temp_dir    = tempfile.gettempdir()
    file_id     = str(uuid.uuid4())
    ffmpeg_exe  = imageio_ffmpeg.get_ffmpeg_exe()

    track_title, artist = _get_metadata(video_id)

    raw_filepath  = os.path.join(temp_dir, f"{file_id}.raw")
    flac_filepath = os.path.join(temp_dir, f"{file_id}.flac")
    downloaded    = False
    source_ext    = "flac"   # TIDAL gives native FLAC; others need conversion

    # ── Method 1: TIDAL ───────────────────────────────────────────────────────
    print(f"\n[{video_id}] Trying TIDAL…")
    tidal_file = os.path.join(temp_dir, f"{file_id}_tidal")
    if _download_via_tidal(track_title, artist, tidal_file):
        # Check what container TIDAL gave us
        probe = subprocess.run(
            [ffmpeg_exe, "-i", tidal_file, "-hide_banner"],
            capture_output=True, text=True
        )
        probe_out = probe.stderr.lower()
        if "flac" in probe_out:
            os.rename(tidal_file, flac_filepath)
            print("✅ TIDAL: native FLAC — no conversion needed")
            return flac_filepath, track_title, artist, "flac"
        else:
            # Convert m4a / aac / opus to FLAC
            try:
                subprocess.run(
                    [ffmpeg_exe, "-y", "-i", tidal_file, "-c:a", "flac", flac_filepath],
                    check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
                )
                os.remove(tidal_file)
                if os.path.getsize(flac_filepath) > 10_000:
                    print("✅ TIDAL: converted to FLAC")
                    return flac_filepath, track_title, artist, "flac"
            except Exception as e:
                print(f"TIDAL ffmpeg conversion failed: {e}")
            try:
                os.remove(tidal_file)
            except Exception:
                pass

    # ── Method 2: yt-dlp with WARP SOCKS5 proxy ──────────────────────────────
    print(f"[{video_id}] Trying yt-dlp + WARP proxy…")
    try:
        ydl_opts = {
            "format":      "bestaudio/best",
            "outtmpl":     os.path.join(temp_dir, f"{file_id}.%(ext)s"),
            "quiet":       True,
            "no_warnings": True,
            "proxy":       "socks5://127.0.0.1:40000",
            "extractor_args": {
                "youtube": {
                    "player_client": ["ios", "android_music", "web_embedded"],
                    "player_skip":   ["webpage"],
                }
            },
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info        = ydl.extract_info(youtube_url, download=True)
            actual_file = ydl.prepare_filename(info)
            if not os.path.exists(actual_file):
                for ext in (".webm", ".m4a", ".opus", ".mp4", ".ogg"):
                    candidate = os.path.splitext(actual_file)[0] + ext
                    if os.path.exists(candidate):
                        actual_file = candidate
                        break
            if os.path.exists(actual_file):
                os.rename(actual_file, raw_filepath)
                downloaded = True
                print("✅ yt-dlp WARP: success")
    except Exception as e:
        print(f"yt-dlp WARP failed: {e}")

    # ── Method 3: yt-dlp direct (no proxy) ───────────────────────────────────
    if not downloaded:
        print(f"[{video_id}] Trying yt-dlp direct…")
        try:
            ydl_opts = {
                "format":      "bestaudio/best",
                "outtmpl":     os.path.join(temp_dir, f"{file_id}.%(ext)s"),
                "quiet":       True,
                "no_warnings": True,
                "extractor_args": {
                    "youtube": {
                        "player_client": ["ios", "android_music", "web_embedded"],
                        "player_skip":   ["webpage"],
                    }
                },
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info        = ydl.extract_info(youtube_url, download=True)
                actual_file = ydl.prepare_filename(info)
                if not os.path.exists(actual_file):
                    for ext in (".webm", ".m4a", ".opus", ".mp4", ".ogg"):
                        candidate = os.path.splitext(actual_file)[0] + ext
                        if os.path.exists(candidate):
                            actual_file = candidate
                            break
                if os.path.exists(actual_file):
                    os.rename(actual_file, raw_filepath)
                    downloaded = True
                    print("✅ yt-dlp direct: success")
        except Exception as e:
            print(f"yt-dlp direct failed: {e}")

    # ── Method 4: Invidious proxy pool (chunked Range requests) ──────────────
    if not downloaded:
        print(f"[{video_id}] Trying Invidious pool…")
        audio_url = None
        for instance in INVIDIOUS_INSTANCES:
            try:
                api_url = f"{instance}/api/v1/videos/{video_id}?fields=adaptiveFormats"
                resp    = requests.get(api_url, timeout=12,
                                       headers={"User-Agent": random.choice(_USER_AGENTS)})
                if resp.status_code != 200:
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
            except Exception as e:
                print(f"  Invidious {instance}: {e}")

        if audio_url:
            if _chunked_range_download(audio_url, raw_filepath):
                downloaded = True
                print("✅ Invidious chunked: success")

    if not downloaded:
        raise Exception("All download methods failed. Try again later.")

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


# ─────────────────────────────────────────────────────────────────────────────
# TIDAL management endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/api/tidal/status", methods=["GET"])
def tidal_status():
    """Check if TIDAL session is active."""
    session = _load_tidal_session()
    if session and session.check_login():
        user_id = str(session.user.id) if session.user else "unknown"
        return jsonify({"status": "connected", "user_id": user_id})
    return jsonify({"status": "disconnected"})


@app.route("/api/tidal/login", methods=["POST"])
def tidal_login():
    """
    Initiate TIDAL device-code OAuth.
    Returns a URL the user must open in their browser to authorize.
    After they approve, the token is saved automatically.
    """
    global _tidal_login_data

    tidalapi = _get_tidalapi()
    if not tidalapi:
        return jsonify({"error": "tidalapi not installed on server"}), 500

    try:
        config  = _make_tidal_config(tidalapi)
        session = tidalapi.Session(config)
        login, future = session.login_oauth()

        _tidal_login_data = {"session": session, "future": future}

        def _await_token():
            global _tidal_session
            try:
                future.result(timeout=300)
                if session.check_login():
                    _save_tidal_token(session)
                    with _tidal_session_lock:
                        _tidal_session = session
                    print("✅ TIDAL: device-code login complete")
            except Exception as e:
                print(f"TIDAL login wait error: {e}")

        threading.Thread(target=_await_token, daemon=True).start()

        return jsonify({
            "url":        login.verification_uri_complete,
            "code":       login.user_code,
            "expires_in": int(login.expires_in),
            "message":    "Open the URL in your browser, log in to TIDAL, then call /api/tidal/token to get your credentials.",
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tidal/token", methods=["GET"])
def tidal_token():
    """
    Returns the current TIDAL token as JSON.
    Copy this entire response and set it as the TIDAL_TOKEN_JSON env var in Railway.
    That way the token survives server restarts.
    """
    session = _load_tidal_session()
    if not session or not session.check_login():
        return jsonify({"error": "No active TIDAL session. Call /api/tidal/login first."}), 401

    expiry = session.expiry_time
    if expiry and hasattr(expiry, "isoformat"):
        expiry = expiry.isoformat()
    elif expiry:
        expiry = str(expiry)

    token_data = {
        "token_type":    session.token_type    or "Bearer",
        "access_token":  session.access_token,
        "refresh_token": session.refresh_token,
        "expiry_time":   expiry,
    }
    return jsonify({
        "token":       token_data,
        "instructions": (
            "Copy the 'token' object, stringify it as JSON, "
            "and set it as the TIDAL_TOKEN_JSON environment variable in Railway. "
            "The server will load it on next restart automatically."
        )
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
