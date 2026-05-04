import base64
import jiosaavn
from pyDes import *

def format_song(data, lyrics):
    try:
        data['media_url'] = decrypt_url(data['encrypted_media_url'])
        if data.get('320kbps') != "true":
            data['media_url'] = data['media_url'].replace(
                "_320.mp4", "_160.mp4")
        data['media_preview_url'] = data['media_url'].replace(
            "_320.mp4", "_96_p.mp4").replace("_160.mp4", "_96_p.mp4").replace("//aac.", "//preview.")
    except (KeyError, TypeError):
        url = data.get('media_preview_url', '')
        url = url.replace("preview", "aac")
        if data.get('320kbps') == "true":
            url = url.replace("_96_p.mp4", "_320.mp4")
        else:
            url = url.replace("_96_p.mp4", "_160.mp4")
        data['media_url'] = url

    data['song'] = format_str(data.get('song', ''))
    data['music'] = format_str(data.get('music', ''))
    data['singers'] = format_str(data.get('singers', ''))
    data['starring'] = format_str(data.get('starring', ''))
    data['album'] = format_str(data.get('album', ''))
    data["primary_artists"] = format_str(data.get("primary_artists", ''))
    data['image'] = data.get('image', '').replace("150x150", "500x500")

    if lyrics:
        if data.get('has_lyrics') == 'true':
            data['lyrics'] = jiosaavn.get_lyrics(data.get('id'))
        else:
            data['lyrics'] = None

    if 'copyright_text' in data:
        data['copyright_text'] = data['copyright_text'].replace("&copy;", "©")

    return data

def format_album(data, lyrics):
    data['image'] = data.get('image', '').replace("150x150", "500x500")
    data['name'] = format_str(data.get('name', ''))
    data['primary_artists'] = format_str(data.get('primary_artists', ''))
    data['title'] = format_str(data.get('title', ''))
    if 'songs' in data:
        for i, song in enumerate(data['songs']):
            data['songs'][i] = format_song(song, lyrics)
    return data

def format_playlist(data, lyrics):
    data['firstname'] = format_str(data.get('firstname', ''))
    data['listname'] = format_str(data.get('listname', ''))
    if 'songs' in data:
        for i, song in enumerate(data['songs']):
            data['songs'][i] = format_song(song, lyrics)
    return data

def format_str(string):
    if not string:
        return string
    return string.encode('utf-8', 'ignore').decode('utf-8', 'ignore').replace("&quot;", "'").replace("&amp;", "&").replace("&#039;", "'")

def decrypt_url(url):
    des_cipher = des(b"38346591", ECB, b"\0\0\0\0\0\0\0\0",
                     pad=None, padmode=PAD_PKCS5)
    enc_url = base64.b64decode(url.strip())
    dec_url = des_cipher.decrypt(enc_url, padmode=PAD_PKCS5).decode('utf-8')
    dec_url = dec_url.replace("_96.mp4", "_320.mp4")
    return dec_url
