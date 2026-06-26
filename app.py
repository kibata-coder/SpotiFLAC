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


import requests

def download_audio(video_id):
    if not video_id:
        raise Exception('Missing video_id')
        
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    
    # List of public Cobalt instances to act as a proxy pool
    cobalt_instances = [
        "https://cobalt.keller-oliver.de",
        "https://api.cobalt.tools",
        "https://co.wuk.sh",
        "https://cobalt.kheina.com"
    ]
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    
    payload = {
        "url": youtube_url,
        "isAudioOnly": True,
        "aFormat": "best"
    }
    
    direct_url = None
    for instance in cobalt_instances:
        try:
            print(f"Trying Cobalt instance: {instance}")
            response = requests.post(f"{instance}/api/json", json=payload, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "url" in data:
                    direct_url = data["url"]
                    print(f"Successfully got download URL from {instance}")
                    break
        except Exception as e:
            print(f"Failed to use instance {instance}: {e}")
            
    if not direct_url:
        raise Exception("All public proxy instances failed. The datacenter ban could not be bypassed.")
        
    return direct_url


@app.route('/api/download', methods=['POST'])
def download():
    data = request.json or {}
    spotify_id = data.get('spotify_id') # The frontend still sends this as "spotify_id", but it's now actually the YouTube videoId!
    
    if not spotify_id:
        return jsonify({'error': 'Missing spotify_id (videoId)'}), 400

    try:
        direct_url = download_audio(spotify_id)
        
        # Return the direct download URL so the frontend can redirect the user to it
        return jsonify({'download_url': direct_url})

    except Exception as e:
        print(f"Error during download: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/stream', methods=['GET'])
def stream():
    spotify_id = request.args.get('spotify_id') # This is now the YouTube videoId
    
    if not spotify_id:
        return jsonify({'error': 'Missing spotify_id (videoId)'}), 400

    try:
        direct_url = download_audio(spotify_id)
        
        # Redirect the stream player to the direct audio URL
        from flask import redirect
        return redirect(direct_url)

    except Exception as e:
        print(f"Error during stream: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
