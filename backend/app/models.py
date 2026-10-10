from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class TrackBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    artist_name: str = Field(..., alias="artist_name", min_length=1, max_length=100)
    album_name: Optional[str] = Field(None, alias="album_name", max_length=100)
    genre: Optional[str] = Field(None, example="Pop", description="The musical genre of the track")
    duration_seconds: int = Field(..., gt=0)
    audio_url: Optional[str] = Field(None, alias="audio_url")
    cover_art_url: Optional[str] = Field(None, alias="cover_art_url")

    model_config = ConfigDict(
        populate_by_name=True,
        extra="allow"
    )

class TrackResponse(TrackBase):
    id: str = Field(..., alias="_id")
    created_at: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True
    )