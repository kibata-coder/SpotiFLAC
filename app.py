from flask import Flask, request, jsonify, send_file, render_template
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import yt_dlp
import os
import tempfile
import uuid

app = Flask(__name__)

# --- Configuration ---
# Spotify API configuration
# (Please replace these placeholders with your actual Spotify credentials)
SPOTIPY_CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID'
SPOTIPY_CLIENT_SECRET = 'YOUR_SPOTIFY_CLIENT_SECRET'

# Set environment variables for spotipy
os.environ['SPOTIPY_CLIENT_ID'] = SPOTIPY_CLIENT_ID
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


@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('query')
    if not query:
        return jsonify({'error': 'Missing query'}), 400
    
    if not sp:
        return jsonify({'error': 'Spotify API not configured on server.'}), 500

    try:
        results = sp.search(q=query, type='track', limit=10)
        tracks = []
        for track in results['tracks']['items']:
            image_url = track['album']['images'][0]['url'] if track['album']['images'] else ''
            tracks.append({
                'id': track['id'],
                'title': track['name'],
                'artist': track['artists'][0]['name'],
                'album': track['album']['name'],
                'image': image_url,
                'preview_url': track['preview_url']
            })
        return jsonify(tracks)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/download', methods=['GET'])
def download():
    track_title = request.args.get('track_title')
    artist = request.args.get('artist')
    
    if not track_title or not artist:
        return jsonify({'error': 'Missing track_title or artist'}), 400

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

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Search youtube and extract info
            info = ydl.extract_info(f"ytsearch1:{search_query}", download=True)
            if not info or 'entries' not in info or len(info['entries']) == 0:
                return jsonify({'error': 'Track not found on YouTube'}), 404
            
            entry = info['entries'][0]
            ext = entry.get('ext', 'webm')
            
            # Find the generated audio file
            expected_filepath = os.path.join(temp_dir, f"{file_id}.{ext}")
            
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


if __name__ == '__main__':
    # Using 0.0.0.0 and port 10000 for standard cloud environments (e.g. Render)
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
