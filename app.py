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
import tempfile
import uuid
import os

def download_audio(video_id):
    if not video_id:
        raise Exception('Missing video_id')
        
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    temp_dir = tempfile.gettempdir()
    file_id = str(uuid.uuid4())
    
    # Use yt-dlp to extract track info and download
    # We use the rescue parameters: "youtube:player_client=tv,web_embedded;player_skip=webpage" and --force-ipv4
    
    # First, get video title and artist
    # (Optional, but yt-dlp can output JSON. We will just use oEmbed or yt-dlp to get title)
    import urllib.request, json
    track_title = "Unknown Track"
    artist = "Unknown Artist"
    try:
        oembed = f"https://www.youtube.com/oembed?url={youtube_url}&format=json"
        with urllib.request.urlopen(oembed, timeout=10) as r:
            data = json.loads(r.read())
            track_title = data.get("title", "Unknown Track")
            artist = data.get("author_name", "Unknown Artist")
    except Exception as e:
        print(f"Failed to fetch metadata via oEmbed: {e}")
        
    # Download the best audio using yt-dlp
    downloaded_filepath = os.path.join(temp_dir, f"{file_id}.%(ext)s")
    
    try:
        subprocess.run([
            "yt-dlp",
            "--extractor-args", "youtube:player_client=tv,web_embedded;player_skip=webpage",
            "--force-ipv4",
            "-f", "bestaudio/best",
            "-o", downloaded_filepath,
            youtube_url
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        error_output = e.stderr.decode('utf-8', errors='ignore') if e.stderr else "Unknown error"
        raise Exception(f"yt-dlp failed to download the audio. The datacenter ban could not be bypassed. Error: {error_output}")
        
    # Find the actual downloaded file since yt-dlp replaces %(ext)s
    actual_downloaded_file = None
    for f in os.listdir(temp_dir):
        if f.startswith(file_id) and f != f"{file_id}.flac":
            actual_downloaded_file = os.path.join(temp_dir, f)
            break
            
    if not actual_downloaded_file:
        raise Exception("Failed to find downloaded audio file.")
        
    # Convert to FLAC using ffmpeg via imageio_ffmpeg
    import imageio_ffmpeg
    
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    flac_filename = f"{file_id}.flac"
    flac_filepath = os.path.join(temp_dir, flac_filename)
    
    subprocess.run([
        ffmpeg_exe,
        '-y',
        '-i', actual_downloaded_file,
        flac_filepath
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # Optionally remove the original downloaded file
    try:
        os.remove(actual_downloaded_file)
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
