from flask import Flask, request, jsonify, send_file, render_template
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import yt_dlp
import os
import tempfile
import uuid
from flask_cors import CORS

app = Flask(__name__)
# Enable CORS for the React frontend
CORS(app)

# Spotify API configuration
SPOTIPY_CLIENT_ID = os.environ.get('SPOTIPY_CLIENT_ID', 'YOUR_SPOTIFY_CLIENT_ID')
SPOTIPY_CLIENT_SECRET = os.environ.get('SPOTIPY_CLIENT_SECRET', 'YOUR_SPOTIFY_CLIENT_SECRET')

# If environment variables are set, ensure spotipy can find them in os.environ
if SPOTIPY_CLIENT_ID and SPOTIPY_CLIENT_ID != 'YOUR_SPOTIFY_CLIENT_ID':
    os.environ['SPOTIPY_CLIENT_ID'] = SPOTIPY_CLIENT_ID
if SPOTIPY_CLIENT_SECRET and SPOTIPY_CLIENT_SECRET != 'YOUR_SPOTIFY_CLIENT_SECRET':
    os.environ['SPOTIPY_CLIENT_SECRET'] = SPOTIPY_CLIENT_SECRET

# Initialize Spotipy client if credentials are valid
try:
    auth_manager = SpotifyClientCredentials()
    sp = spotipy.Spotify(auth_manager=auth_manager)
except Exception as e:
    print(f"Warning: Spotify not configured correctly yet. {e}")
    sp = None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/search', methods=['POST'])
def search():
    data = request.json or {}
    query = data.get('query')
    search_type = data.get('search_type', 'track')
    limit = data.get('limit', 20)
    
    if not query:
        return jsonify({'error': 'Missing query'}), 400
    
    if not sp:
        return jsonify({'error': 'Spotify API not configured on server.'}), 500

    try:
        results = sp.search(q=query, type='track', limit=limit)
        tracks = []
        for track in results['tracks']['items']:
            image_url = track['album']['images'][0]['url'] if track['album']['images'] else ''
            artists_str = ", ".join([a['name'] for a in track['artists']])
            tracks.append({
                'id': track['id'],
                'name': track['name'],
                'artists': artists_str,
                'album': track['album']['name'],
                'cover': image_url
            })
        return jsonify(tracks)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def download_audio(spotify_id):
    if not sp:
        raise Exception('Spotify API not configured on server.')
        
    # Get track info from Spotify
    track = sp.track(spotify_id)
    track_title = track['name']
    artist = track['artists'][0]['name']
    
    search_query = f"{track_title} {artist} audio"
    
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

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        # Search youtube and extract info
        info = ydl.extract_info(f"ytsearch1:{search_query}", download=True)
        if not info or 'entries' not in info or len(info['entries']) == 0:
            raise Exception('Track not found on YouTube')
        
        entry = info['entries'][0]
        ext = entry.get('ext', 'webm')
        
        # Find the generated audio file
        expected_filepath = os.path.join(temp_dir, f"{file_id}.{ext}")
        return expected_filepath, track_title, artist, ext


@app.route('/api/download', methods=['POST'])
def download():
    data = request.json or {}
    spotify_id = data.get('spotify_id')
    
    if not spotify_id:
        return jsonify({'error': 'Missing spotify_id'}), 400

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
    spotify_id = request.args.get('spotify_id')
    
    if not spotify_id:
        return jsonify({'error': 'Missing spotify_id'}), 400

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
