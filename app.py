from flask import Flask, request, jsonify, send_file, render_template
from ytmusicapi import YTMusic
import yt_dlp
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
        
    # We use a temporary directory to store the file
    temp_dir = tempfile.gettempdir()
    file_id = str(uuid.uuid4())
    output_template = os.path.join(temp_dir, f"{file_id}.%(ext)s")

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_template,
        'noplaylist': True,
        'quiet': True,
    }
    
    # We can fetch the track details directly from YouTube Music since we have the videoId
    track_title = "Unknown Track"
    artist = "Unknown Artist"
    try:
        if ytmusic:
            song_info = ytmusic.get_song(video_id)
            if 'videoDetails' in song_info:
                track_title = song_info['videoDetails']['title']
                artist = song_info['videoDetails']['author']
    except Exception as e:
        print(f"Warning: Could not fetch exact title/artist for {video_id}: {e}")

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        # We can pass the URL directly since we know the videoId!
        url = f"https://www.youtube.com/watch?v={video_id}"
        info = ydl.extract_info(url, download=True)
        if not info:
            raise Exception('Failed to extract info from YouTube')
        
        # If we didn't get title/artist earlier, we can get it from yt-dlp info
        if track_title == "Unknown Track":
            track_title = info.get('title', track_title)
            artist = info.get('uploader', artist)
            
        ext = info.get('ext', 'webm')
        
        # Find the generated audio file
        expected_filepath = os.path.join(temp_dir, f"{file_id}.{ext}")
        return expected_filepath, track_title, artist, ext


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
    # Using 0.0.0.0 and port 10000 for standard cloud environments (e.g. Render)
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
