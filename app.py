from flask import Flask, request, jsonify, send_file, render_template
from ytmusicapi import YTMusic
from pytubefix import YouTube
import os
import tempfile
import uuid
from flask_cors import CORS

app = Flask(__name__)
# Enable CORS for the React frontend
CORS(app)

# Initialize YTMusic without authentication (perfect for search)
try:
    ytmusic = YTMusic()
except Exception as e:
    print(f"Warning: YTMusic not configured correctly yet. {e}")
    ytmusic = None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/search', methods=['POST'])
def search():
    data = request.json or {}
    query = data.get('query')
    limit = data.get('limit', 20)
    
    if not query:
        return jsonify({'error': 'Missing query'}), 400
    
    if not ytmusic:
        return jsonify({'error': 'YTMusic API not configured on server.'}), 500

    try:
        results = ytmusic.search(query=query, filter="songs", limit=limit)
        tracks = []
        for track in results:
            if track.get('resultType') != 'song':
                continue
                
            # Get the best resolution image
            thumbnails = track.get('thumbnails', [])
            image_url = thumbnails[-1]['url'] if thumbnails else ''
            
            # Extract artists safely
            artists = track.get('artists', [])
            artists_str = ", ".join([a['name'] for a in artists]) if artists else "Unknown Artist"
            
            # Extract album safely
            album = track.get('album')
            album_name = album['name'] if album else "Unknown Album"
            
            tracks.append({
                'id': track['videoId'],
                'name': track['title'],
                'artists': artists_str,
                'album': album_name,
                'cover': image_url
            })
        return jsonify(tracks)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


import subprocess
import requests
import json
import urllib.request

# Updated pool of public Invidious API instances (community-run YouTube frontends)
INVIDIOUS_INSTANCES = [
    "https://inv.nadeko.net",
    "https://invidious.privacydev.net",
    "https://invidious.nerdvpn.de",
    "https://iv.melmac.space",
    "https://invidious.io.lol",
    "https://invidious.jing.rocks",
    "https://invidious.projectsegfau.lt",
    "https://invidious.fdn.fr",
    "https://vid.puffyan.us",
    "https://yt.artemislena.eu",
    "https://invidious.lunar.icu",
    "https://invidious.tiekoetter.com",
]

def download_audio(video_id):
    if not video_id:
        raise Exception('Missing video_id')

    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    temp_dir = tempfile.gettempdir()
    file_id = str(uuid.uuid4())

    # Step 1: Get track title/artist via YouTube oEmbed (almost never blocked)
    track_title = "Unknown Track"
    artist = "Unknown Artist"
    try:
        oembed = f"https://www.youtube.com/oembed?url={youtube_url}&format=json"
        with urllib.request.urlopen(oembed, timeout=8) as r:
            meta = json.loads(r.read())
            track_title = meta.get("title", "Unknown Track")
            artist = meta.get("author_name", "Unknown Artist")
    except Exception as e:
        print(f"oEmbed metadata failed: {e}")

    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    import yt_dlp

    raw_filepath = os.path.join(temp_dir, f"{file_id}.webm")
    flac_filepath = os.path.join(temp_dir, f"{file_id}.flac")
    downloaded_ok = False

    # ---- Method 1: yt-dlp directly (works if Railway IPs are not banned) ----
    print("Trying yt-dlp direct download...")
    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': raw_filepath,
            'quiet': True,
            'no_warnings': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['ios', 'android_music', 'web_embedded'],
                    'player_skip': ['webpage'],
                }
            },
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            # yt-dlp may append an extension to the filename
            actual_file = ydl.prepare_filename(info)
            if not os.path.exists(actual_file):
                # Try common extensions it may have used
                for ext in ['.webm', '.m4a', '.opus', '.mp4']:
                    candidate = os.path.splitext(actual_file)[0] + ext
                    if os.path.exists(candidate):
                        actual_file = candidate
                        break
            if os.path.exists(actual_file):
                if actual_file != raw_filepath:
                    os.rename(actual_file, raw_filepath)
                downloaded_ok = True
                print("yt-dlp direct download succeeded.")
    except Exception as e:
        print(f"yt-dlp direct failed: {e}")

    # ---- Method 2: Invidious proxy pool (fallback) ----
    if not downloaded_ok:
        print("Falling back to Invidious proxy pool...")
        direct_audio_url = None
        for instance in INVIDIOUS_INSTANCES:
            try:
                api_url = f"{instance}/api/v1/videos/{video_id}?fields=adaptiveFormats,formatStreams"
                print(f"Trying Invidious instance: {instance}")
                resp = requests.get(api_url, timeout=12, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code != 200:
                    continue
                data = resp.json()

                best_audio = None
                best_bitrate = 0
                for fmt in data.get("adaptiveFormats", []):
                    if fmt.get("type", "").startswith("audio/") and fmt.get("url"):
                        bitrate = int(fmt.get("bitrate", 0))
                        if bitrate > best_bitrate:
                            best_bitrate = bitrate
                            best_audio = fmt

                if best_audio:
                    direct_audio_url = best_audio["url"]
                    print(f"Got audio URL from {instance} at {best_bitrate} bps")
                    break
            except Exception as e:
                print(f"Invidious instance {instance} failed: {e}")

        if direct_audio_url:
            try:
                with requests.get(direct_audio_url, stream=True, timeout=90, headers={"User-Agent": "Mozilla/5.0"}) as dl:
                    dl.raise_for_status()
                    with open(raw_filepath, 'wb') as f:
                        for chunk in dl.iter_content(chunk_size=65536):
                            f.write(chunk)
                downloaded_ok = True
                print("Invidious proxy download succeeded.")
            except Exception as e:
                print(f"Invidious proxy download failed: {e}")

    if not downloaded_ok or not os.path.exists(raw_filepath):
        raise Exception("All download methods failed. Please try again later.")

    # Step 3: Convert to FLAC using ffmpeg
    try:
        subprocess.run([
            ffmpeg_exe, '-y', '-i', raw_filepath, flac_filepath
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        raise Exception("ffmpeg conversion to FLAC failed.")
    finally:
        try:
            os.remove(raw_filepath)
        except:
            pass

    return flac_filepath, track_title, artist, 'flac'


@app.route('/api/download', methods=['POST'])
def download():
    data = request.json or {}
    spotify_id = data.get('spotify_id') # The frontend still sends this as "spotify_id", but it's now actually the YouTube videoId!
    
    if not spotify_id:
        return jsonify({'error': 'Missing spotify_id (videoId)'}), 400

    try:
        expected_filepath, track_title, artist, ext = download_audio(spotify_id)
        
        if os.path.exists(expected_filepath):
            from flask import send_file
            # Send the file to the user
            return send_file(
                expected_filepath,
                as_attachment=True,
                download_name=f"{track_title} - {artist}.{ext}",
                mimetype=f'audio/{ext}'
            )
        else:
            return jsonify({'error': 'File conversion failed'}), 500

    except Exception as e:
        print(f"Error during download: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/stream', methods=['GET'])
def stream():
    spotify_id = request.args.get('spotify_id') # This is now the YouTube videoId
    
    if not spotify_id:
        return jsonify({'error': 'Missing spotify_id (videoId)'}), 400

    try:
        expected_filepath, track_title, artist, ext = download_audio(spotify_id)
        
        if os.path.exists(expected_filepath):
            from flask import send_file
            # Send the file without as_attachment so it streams in browser
            return send_file(
                expected_filepath,
                as_attachment=False,
                mimetype=f'audio/{ext}'
            )
        else:
            return jsonify({'error': 'File conversion failed'}), 500

    except Exception as e:
        print(f"Error during stream: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
