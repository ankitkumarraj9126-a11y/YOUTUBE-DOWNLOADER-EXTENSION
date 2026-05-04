from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Any
import jiosaavn

app = FastAPI(
    title="JioSaavn API",
    description="A FastAPI wrapper for JioSaavn unofficial API.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", include_in_schema=False)
async def home():
    return RedirectResponse(url="https://cyberboysumanjay.github.io/JioSaavnAPI/")

@app.get("/song/")
async def search(
    query: str = Query(..., description="The song name or JioSaavn URL to search for."),
    lyrics: Optional[bool] = Query(False, description="Include lyrics in response?"),
    songdata: Optional[bool] = Query(True, description="Return detailed song data?")
):
    """Search for a song by query or URL."""
    result = jiosaavn.search_for_song(query, lyrics, songdata)
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.get("/song/get/")
async def get_song(
    id: str = Query(..., description="The ID of the song to retrieve."),
    lyrics: Optional[bool] = Query(False, description="Include lyrics in response?")
):
    """Get specific song details by ID."""
    resp = jiosaavn.get_song(id, lyrics)
    if not resp:
        raise HTTPException(status_code=404, detail="Invalid Song ID received or song not found.")
    return resp

@app.get("/playlist/")
async def playlist(
    query: str = Query(..., description="JioSaavn playlist URL."),
    lyrics: Optional[bool] = Query(False, description="Include lyrics for songs in playlist?")
):
    """Get a playlist details from its JioSaavn URL."""
    id = jiosaavn.get_playlist_id(query)
    if not id:
        raise HTTPException(status_code=400, detail="Could not extract playlist ID from URL.")

    songs = jiosaavn.get_playlist(id, lyrics)
    if not songs:
        raise HTTPException(status_code=404, detail="Playlist not found.")
    return songs

@app.get("/album/")
async def album(
    query: str = Query(..., description="JioSaavn album URL."),
    lyrics: Optional[bool] = Query(False, description="Include lyrics for songs in album?")
):
    """Get album details from its JioSaavn URL."""
    id = jiosaavn.get_album_id(query)
    if not id:
        raise HTTPException(status_code=400, detail="Could not extract album ID from URL.")

    songs = jiosaavn.get_album(id, lyrics)
    if not songs:
        raise HTTPException(status_code=404, detail="Album not found.")
    return songs

@app.get("/lyrics/")
async def lyrics_route(
    query: str = Query(..., description="Song URL or Song ID to fetch lyrics for.")
):
    """Get lyrics for a song using its ID or JioSaavn URL."""
    try:
        if 'http' in query and 'saavn' in query:
            id = jiosaavn.get_song_id(query)
            if not id:
                raise HTTPException(status_code=400, detail="Could not extract song ID from URL.")
            lyrics_data = jiosaavn.get_lyrics(id)
        else:
            lyrics_data = jiosaavn.get_lyrics(query)

        if not lyrics_data:
            raise HTTPException(status_code=404, detail="Lyrics not found.")

        return {"status": True, "lyrics": lyrics_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/result/")
async def result(
    query: str = Query(..., description="A generic query (URL or name) to search/resolve."),
    lyrics: Optional[bool] = Query(False, description="Include lyrics in response?")
):
    """A generic endpoint that automatically handles song, album, or playlist URLs."""
    if 'saavn' not in query:
        return jiosaavn.search_for_song(query, lyrics, True)

    try:
        if '/song/' in query:
            song_id = jiosaavn.get_song_id(query)
            if not song_id:
                raise HTTPException(status_code=400, detail="Invalid song URL.")
            song = jiosaavn.get_song(song_id, lyrics)
            return song

        elif '/album/' in query:
            id = jiosaavn.get_album_id(query)
            if not id:
                raise HTTPException(status_code=400, detail="Invalid album URL.")
            songs = jiosaavn.get_album(id, lyrics)
            return songs

        elif '/playlist/' in query or '/featured/' in query:
            id = jiosaavn.get_playlist_id(query)
            if not id:
                raise HTTPException(status_code=400, detail="Invalid playlist URL.")
            songs = jiosaavn.get_playlist(id, lyrics)
            return songs

        else:
            raise HTTPException(status_code=400, detail="URL format not recognized. Must contain /song/, /album/, or /playlist/.")

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
