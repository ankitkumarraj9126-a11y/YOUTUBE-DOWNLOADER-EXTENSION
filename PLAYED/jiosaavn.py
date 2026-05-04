import requests
import endpoints
import helper
import json
from traceback import print_exc
import re
from typing import Optional, List, Dict, Any

def search_for_song(query: str, lyrics: bool, songdata: bool) -> Any:
    if query.startswith('http') and 'saavn.com' in query:
        id = get_song_id(query)
        return get_song(id, lyrics)

    search_base_url = endpoints.search_base_url + query
    try:
        response_text = requests.get(search_base_url).text.encode('latin1').decode('unicode-escape')
    except Exception:
        response_text = requests.get(search_base_url).text

    pattern = r'\(From "([^"]+)"\)'
    try:
        response = json.loads(re.sub(pattern, r"(From '\1')", response_text))
    except json.JSONDecodeError:
        return {"error": "Failed to parse response"}

    song_response = response.get('songs', {}).get('data', [])
    if not songdata:
        return song_response

    songs = []
    for song in song_response:
        id = song.get('id')
        if id:
            song_data = get_song(id, lyrics)
            if song_data:
                songs.append(song_data)
    return songs

def get_song(id: str, lyrics: bool) -> Optional[Dict[str, Any]]:
    try:
        song_details_base_url = endpoints.song_details_base_url + id
        try:
            song_response_text = requests.get(song_details_base_url).text.encode('latin1').decode('unicode-escape')
        except Exception:
            song_response_text = requests.get(song_details_base_url).text

        song_response = json.loads(song_response_text)
        if id in song_response:
            song_data = helper.format_song(song_response[id], lyrics)
            return song_data
        return None
    except Exception:
        print_exc()
        return None

def get_song_id(url: str) -> Optional[str]:
    res = requests.get(url, data=[('bitrate', '320')])
    try:
        return (res.text.split('"pid":"'))[1].split('","')[0]
    except IndexError:
        try:
            return res.text.split('"song":{"type":"')[1].split('","image":')[0].split('"id":"')[-1]
        except IndexError:
            return None

def get_album(album_id: str, lyrics: bool) -> Optional[Dict[str, Any]]:
    try:
        response = requests.get(endpoints.album_details_base_url + album_id)
        if response.status_code == 200:
            try:
                songs_json_text = response.text.encode('latin1').decode('unicode-escape')
            except Exception:
                songs_json_text = response.text

            songs_json = json.loads(songs_json_text)
            return helper.format_album(songs_json, lyrics)
    except Exception as e:
        print(e)
    return None

def get_album_id(input_url: str) -> Optional[str]:
    res = requests.get(input_url)
    try:
        return res.text.split('"album_id":"')[1].split('"')[0]
    except IndexError:
        try:
            return res.text.split('"page_id","')[1].split('","')[0]
        except IndexError:
            return None

def get_playlist(listId: str, lyrics: bool) -> Optional[Dict[str, Any]]:
    try:
        response = requests.get(endpoints.playlist_details_base_url + listId)
        if response.status_code == 200:
            try:
                songs_json_text = response.text.encode('latin1').decode('unicode-escape')
            except Exception:
                songs_json_text = response.text

            songs_json = json.loads(songs_json_text)
            return helper.format_playlist(songs_json, lyrics)
        return None
    except Exception:
        print_exc()
        return None

def get_playlist_id(input_url: str) -> Optional[str]:
    res = requests.get(input_url).text
    try:
        return res.split('"type":"playlist","id":"')[1].split('"')[0]
    except IndexError:
        try:
            return res.split('"page_id","')[1].split('","')[0]
        except IndexError:
            return None

def get_lyrics(id: str) -> Optional[str]:
    url = endpoints.lyrics_base_url + id
    try:
        lyrics_json = requests.get(url).text
        lyrics_text = json.loads(lyrics_json)
        return lyrics_text.get('lyrics')
    except Exception:
        return None
