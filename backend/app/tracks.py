from fastapi import APIRouter, HTTPException
from app.database import tracks_collection
from app.r2 import get_audio_url

router = APIRouter()

@router.get("/tracks", response_model=list)
async def get_tracks():
    try:
        tracks = []
        async for track in tracks_collection.find():
            file_key = track.get("file_key") or track.get("audio_key")
            audio_url = get_audio_url(file_key) if file_key else track.get("audio_url")

            tracks.append({
                "_id": str(track.get("_id")),
                "title": track.get("title"),
                "artist_name": track.get("artist_name"),
                "album_name": track.get("album_name"),
                "genre": track.get("genre"),
                "duration_seconds": track.get("duration_seconds"),
                "audio_url": audio_url,
                "cover_art_url": track.get("cover_art_url")
            })
            
        return tracks
    except Exception as e:
        print(f"Error fetching tracks: {e}")
        raise HTTPException(status_code=500, detail="Internal server error while fetching tracks")