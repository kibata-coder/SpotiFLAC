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


def download_audio(video_id):
    if not video_id:
        raise Exception('Missing video_id')
        
    temp_dir = tempfile.gettempdir()
    file_id = str(uuid.uuid4())
    url = f"https://www.youtube.com/watch?v={video_id}"

    # We use pytubefix with the TV client to bypass 429 Too Many Requests
    yt = YouTube(url, client='TV', use_po_token=True)
    
    # Extract the highest quality audio stream
    stream = yt.streams.get_audio_only()
    if not stream:
        raise Exception('Failed to find an audio stream for this track')
        
    ext = stream.subtype
    filename = f"{file_id}.{ext}"
    
    # Download the stream to the temporary directory
    downloaded_filepath = stream.download(output_path=temp_dir, filename=filename)
    
    track_title = yt.title or "Unknown Track"
    artist = yt.author or "Unknown Artist"
    
    # Convert to FLAC using ffmpeg via imageio_ffmpeg
    import imageio_ffmpeg
    import subprocess
    
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    flac_filename = f"{file_id}.flac"
    flac_filepath = os.path.join(temp_dir, flac_filename)
    
    # Run ffmpeg to convert the audio file to FLAC
    # -y overwrites output file if it exists, -i is the input file, and we output to flac_filepath
    subprocess.run([
        ffmpeg_exe,
        '-y',
        '-i', downloaded_filepath,
        flac_filepath
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # Optionally remove the original downloaded file to save space
    try:
        os.remove(downloaded_filepath)
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
