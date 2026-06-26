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

# Rotating pool of public Invidious API instances
# These are community-run alternative YouTube frontends that bypass datacenter IP blocks
INVIDIOUS_INSTANCES = [
    "https://invidious.nerdvpn.de",
    "https://inv.nadeko.net",
    "https://invidious.privacydev.net",
    "https://iv.melmac.space",
    "https://invidious.io.lol",
    "https://invidious.jing.rocks",
]

def download_audio(video_id):
    if not video_id:
        raise Exception('Missing video_id')
        
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    temp_dir = tempfile.gettempdir()
    file_id = str(uuid.uuid4())
    
    # Step 1: Get track title/artist via YouTube oEmbed (never blocked)
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

    # Step 2: Ask public Invidious instances for a direct audio stream URL
    # Invidious servers run on residential/non-datacenter IPs so YouTube allows them
    direct_audio_url = None
    for instance in INVIDIOUS_INSTANCES:
        try:
            api_url = f"{instance}/api/v1/videos/{video_id}?fields=adaptiveFormats,formatStreams"
            print(f"Trying Invidious instance: {instance}")
            resp = requests.get(api_url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code != 200:
                continue
            data = resp.json()
            
            # Look for the best audio-only format
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

    if not direct_audio_url:
        raise Exception("All Invidious proxy instances failed to provide an audio URL. Please try again later.")

    # Step 3: Download the audio through the Invidious proxy URL
    raw_filepath = os.path.join(temp_dir, f"{file_id}.webm")
    try:
        with requests.get(direct_audio_url, stream=True, timeout=60, headers={"User-Agent": "Mozilla/5.0"}) as dl:
            dl.raise_for_status()
            with open(raw_filepath, 'wb') as f:
                for chunk in dl.iter_content(chunk_size=65536):
                    f.write(chunk)
    except Exception as e:
        raise Exception(f"Failed to download audio from proxy: {e}")

    # Step 4: Convert to FLAC using ffmpeg
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    flac_filepath = os.path.join(temp_dir, f"{file_id}.flac")
    
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
