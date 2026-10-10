import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

import bcrypt
import boto3
from botocore.config import Config
from bson import ObjectId
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient

# --- Path Setup ---
backend_dir = Path(__file__).resolve().parent
sys.path.append(str(backend_dir))

from app.auth import router as auth_router
from app.tracks import router as tracks_router

app = FastAPI(title="Sway Backend", version="1.0.0")

# --- Database Configuration ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["Sway"]
playlists_collection = db["playlists"]
favorites_collection = db["favorites"]
users_collection = db["users"]
followed_artists_collection = db["followedArtists"]

# --- Cloudflare R2 Storage Configuration ---
s3_client = boto3.client(
    's3',
    endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID', '')}.r2.cloudflarestorage.com",
    aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID', ''),
    aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY', ''),
    config=Config(signature_version='s3v4')
)
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME', '')
R2_PUBLIC_URL = os.getenv('R2_PUBLIC_URL', '')

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Router Registrations ---
app.include_router(tracks_router, prefix="/api")
app.include_router(auth_router, prefix="/api")


# --- Pydantic Data Models ---
class PlaylistModel(BaseModel):
    name: str
    trackIds: Optional[List[str]] = []
    user_email: str

class FavoriteModel(BaseModel):
    user_email: str
    trackId: str

class FollowToggleRequest(BaseModel):
    user_email: str
    artist_name: str

class UserCredentials(BaseModel):
    email: str
    password: str

class UserSignupModel(BaseModel):
    email: str
    password: str
    name: str
    role: Optional[str] = "listener"
    genre: Optional[str] = "Alternative"
    image: Optional[str] = ""


# --- Root Endpoint ---
@app.get("/")
def root():
    return {"message": "Sway Backend is running!"}


# --- Playlist Endpoints ---
@app.get("/api/playlists/{user_email}")
def get_user_playlists(user_email: str):
    playlists = []
    for p in playlists_collection.find({"user_email": user_email}):
        playlists.append({
            "id": str(p["_id"]),
            "name": p["name"],
            "trackIds": p.get("trackIds", []),
            "user_email": p.get("user_email")
        })
    return playlists

@app.post("/api/playlists")
def create_playlist(playlist: PlaylistModel):
    new_playlist = {
        "name": playlist.name,
        "trackIds": playlist.trackIds,
        "user_email": playlist.user_email
    }
    result = playlists_collection.insert_one(new_playlist)
    return {
        "id": str(result.inserted_id),
        "name": playlist.name,
        "trackIds": playlist.trackIds,
        "user_email": playlist.user_email
    }

@app.post("/api/playlists/{playlist_id}/tracks")
def add_track_to_playlist(playlist_id: str, data: dict):
    track_id = data.get("trackId")
    if not track_id:
        raise HTTPException(status_code=400, detail="trackId is required")
    
    playlists_collection.update_one(
        {"_id": ObjectId(playlist_id)},
        {"$addToSet": {"trackIds": track_id}}
    )
    return {"status": "success"}

@app.delete("/api/playlists/{playlist_id}/tracks/{track_id}")
def remove_track_from_playlist(playlist_id: str, track_id: str):
    playlists_collection.update_one(
        {"_id": ObjectId(playlist_id)},
        {"$pull": {"trackIds": track_id}}
    )
    return {"status": "success"}

@app.delete("/api/playlists/{playlist_id}")
def delete_playlist(playlist_id: str):
    playlists_collection.delete_one({"_id": ObjectId(playlist_id)})
    return {"status": "success"}


# --- Favorites Endpoints ---
@app.get("/api/favorites/{user_email}")
def get_user_favorites(user_email: str):
    fav = favorites_collection.find_one({"user_email": user_email})
    return fav.get("trackIds", []) if fav else []

@app.post("/api/favorites/toggle")
def toggle_favorite(data: FavoriteModel):
    fav = favorites_collection.find_one({"user_email": data.user_email})
    if fav:
        track_ids = fav.get("trackIds", [])
        if data.trackId in track_ids:
            track_ids.remove(data.trackId)
        else:
            track_ids.append(data.trackId)
        favorites_collection.update_one(
            {"user_email": data.user_email},
            {"$set": {"trackIds": track_ids}}
        )
    else:
        track_ids = [data.trackId]
        favorites_collection.insert_one({
            "user_email": data.user_email,
            "trackIds": track_ids
        })
    return {"status": "success", "trackIds": track_ids}


# --- Following Endpoints ---
@app.get("/api/follows/{user_email}")
def get_user_following(user_email: str):
    user_doc = followed_artists_collection.find_one({"user_email": user_email})
    if not user_doc or "artists" not in user_doc:
        return []
    return user_doc["artists"]

@app.post("/api/follows/toggle")
def toggle_follow_artist(req: FollowToggleRequest):
    user_email = req.user_email
    artist_name = req.artist_name

    user_doc = followed_artists_collection.find_one({"user_email": user_email})
    
    if user_doc:
        artists = user_doc.get("artists", [])
        if artist_name in artists:
            artists.remove(artist_name)
        else:
            artists.append(artist_name)
        
        followed_artists_collection.update_one(
            {"user_email": user_email},
            {"$set": {"artists": artists}}
        )
    else:
        artists = [artist_name]
        followed_artists_collection.insert_one({
            "user_email": user_email,
            "artists": artists
        })

    return {"status": "success", "followed_artists": artists}


# --- Authentication & User Profile Endpoints ---
@app.get("/api/users/{email}")
def get_user_profile(email: str):
    user = users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "email": user.get("email"),
        "name": user.get("name"),
        "genre": user.get("genre", "Alternative"),
        "image": user.get("image") or user.get("profile_pic", ""),
        "profile_pic": user.get("profile_pic", "")
    }

@app.post("/api/signin")
def sign_in(credentials: UserCredentials):
    clean_email = credentials.email.lower().strip()
    user = users_collection.find_one({"email": clean_email})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
        
    stored_password = user.get("password", "")
    is_password_valid = bcrypt.checkpw(
        credentials.password.encode('utf-8'),
        stored_password.encode('utf-8')
    )
    
    if not is_password_valid:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    return {
        "success": True,
        "email": user.get("email"),
        "name": user.get("name"),
        "genre": user.get("genre", "Alternative"),
        "profile_pic": user.get("profile_pic", ""),
        "image": user.get("image") or user.get("profile_pic", "")
    }

@app.post("/api/signup")
def sign_up(user: UserSignupModel):
    clean_email = user.email.lower().strip()
    
    # 1. Check if email is already registered
    if users_collection.find_one({"email": clean_email}):
        raise HTTPException(status_code=400, detail="Email is already registered")
    
    # 2. Strict database check for duplicate names (case-insensitive & whitespace-stripped)
    if user.name:
        clean_name = user.name.strip()
        clean_name_lower = clean_name.lower()
        
        for existing_user in users_collection.find({}):
            ex_name = str(existing_user.get("name", "")).strip().lower()
            ex_artist_name = str(existing_user.get("artist_name", "")).strip().lower()
            
            if clean_name_lower == ex_name or (ex_artist_name and clean_name_lower == ex_artist_name):
                raise HTTPException(
                    status_code=400, 
                    detail="Duplicate name not allowed: An artist or user with this name already exists."
                )

    hashed_password = bcrypt.hashpw(
        user.password.encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')

    new_user = {
        "email": clean_email,
        "password": hashed_password,
        "name": user.name.strip(),
        "artist_name": user.name.strip(),
        "role": user.role,
        "genre": user.genre or "Alternative",
        "image": user.image or "",
        "profile_pic": user.image or ""
    }
    users_collection.insert_one(new_user)

    return {
        "success": True,
        "message": "Account created successfully",
        "email": clean_email,
        "name": user.name.strip(),
        "role": user.role,
        "genre": user.genre
    }

@app.post("/api/users/profile-pic")
async def upload_profile_pic(email: str = Form(...), file: UploadFile = File(...)):
    try:
        file_extension = file.filename.split(".")[-1] if file.filename else "jpg"
        file_name = f"profiles/{email.replace('@', '_')}_{os.urandom(4).hex()}.{file_extension}"

        s3_client.upload_fileobj(
            file.file,
            R2_BUCKET_NAME,
            file_name,
            ExtraArgs={"ContentType": file.content_type}
        )

        image_url = f"{R2_PUBLIC_URL}/{file_name}"
        result = users_collection.update_one(
            {"email": email.lower().strip()},
            {"$set": {"profile_pic": image_url, "image": image_url}}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")

        return {"success": True, "profile_pic": image_url, "image": image_url}
    except Exception as e:
        print("R2 Upload Error:", e)
        raise HTTPException(status_code=500, detail="Failed to upload profile picture")


# --- Artists & Search Endpoints ---
@app.get("/api/artists")
def get_artists_with_tracks():
    artists_list = []
    seen = set()
    
    # 1. From users collection (STRICTLY role == 'artist')
    for user in users_collection.find({}):
        role_str = str(user.get("role", "")).strip().lower()
        
        # Explicitly exclude listeners
        if role_str == "listener" or "listener" in role_str:
            continue
            
        # Must have role == 'artist' or contain 'artist'
        if "artist" not in role_str:
            continue
            
        artist_name = user.get("name") or user.get("artist_name")
        if not artist_name or artist_name.lower() in seen:
            continue
        seen.add(artist_name.lower())
            
        profile_pic = user.get("profile_pic") or user.get("image") or user.get("image_url") or user.get("cover_art_url") or ""
        artist_tracks = list(db["tracks"].find({
            "$or": [
                {"artist_name": {"$regex": f"^{re.escape(artist_name)}$", "$options": "i"}},
                {"artist_name": user.get("name", "")},
                {"artist_name": user.get("artist_name", "")}
            ]
        }))
        
        formatted_songs = [{**track, "_id": str(track["_id"])} for track in artist_tracks]
        primary_genre = user.get("genre", "Alternative")

        artists_list.append({
            "id": str(user["_id"]),
            "_id": str(user["_id"]),
            "name": artist_name,
            "artist_name": artist_name,
            "role": "artist",
            "email": user.get("email"),
            "image_url": profile_pic,
            "image": profile_pic,
            "profile_pic": profile_pic,
            "songs": formatted_songs,
            "latest_release": formatted_songs[0] if formatted_songs else None,
            "bio": user.get("bio") or user.get("description") or "",
            "genre": primary_genre,
            "genres": user.get("genres") or [primary_genre]
        })

        
    # 2. Also check if there is a dedicated 'artists' collection in MongoDB
    try:
        for a in db["artists"].find({}):
            a_name = a.get("name") or a.get("artist_name")
            if a_name and a_name.lower() not in seen:
                seen.add(a_name.lower())
                img = a.get("profile_pic") or a.get("image") or a.get("image_url") or a.get("cover_art_url") or ""
                artists_list.append({
                    "id": str(a["_id"]),
                    "_id": str(a["_id"]),
                    "name": a_name,
                    "artist_name": a_name,
                    "email": a.get("email"),
                    "image_url": img,
                    "image": img,
                    "profile_pic": img,
                    "songs": a.get("songs") or [],
                    "latest_release": None,
                    "bio": a.get("bio") or a.get("description") or "",
                    "genre": a.get("genre", "Alternative"),
                    "genres": [a.get("genre", "Alternative")]
                })
    except Exception:
        pass
        
    return artists_list


@app.get("/api/search")
def global_search(q: str = ""):
    if not q:
        return {"tracks": [], "artists": []}
    
    q_lower = q.lower()
    
    # 1. Search tracks
    tracks = []
    matching_artist_names = set()
    for track in db["tracks"].find({}):
        if (q_lower in str(track.get("title", "")).lower() or 
            q_lower in str(track.get("artist_name", "")).lower() or 
            q_lower in str(track.get("genre", "")).lower()):
            
            track["_id"] = str(track["_id"])
            tracks.append(track)
            if track.get("artist_name"):
                matching_artist_names.add(track.get("artist_name").lower())
        
    # 2. Search users collection
    found_artists = []
    for user in users_collection.find({}):
        u_name = str(user.get("name", ""))
        u_email = str(user.get("email", ""))
        u_genre = str(user.get("genre", ""))
        artist_name = str(user.get("artist_name", ""))
        
        is_match = (
            q_lower in u_name.lower() or
            q_lower in artist_name.lower() or
            q_lower in u_email.lower() or
            q_lower in u_genre.lower() or
            u_name.lower() in matching_artist_names or
            artist_name.lower() in matching_artist_names
        )
        
        if is_match:
            display_name = u_name or user.get("artist_name")
            if not display_name:
                continue
                
            profile_pic = user.get("profile_pic") or user.get("image") or ""
            artist_tracks = list(db["tracks"].find({
                "$or": [
                    {"artist_name": display_name},
                    {"artist_name": u_name},
                    {"artist_name": artist_name}
                ]
            }))
            
            formatted_songs = [{**t, "_id": str(t["_id"])} for t in artist_tracks]
            primary_genre = user.get("genre", "Alternative")
            
            found_artists.append({
                "id": str(user["_id"]),
                "_id": str(user["_id"]),
                "name": display_name,
                "email": user.get("email"),
                "image_url": profile_pic,
                "image": profile_pic,
                "songs": formatted_songs,
                "latest_release": formatted_songs[0] if formatted_songs else None,
                "bio": "",
                "genre": primary_genre,
                "genres": user.get("genres") or [primary_genre]
            })

    return {
        "tracks": tracks,
        "artists": found_artists
    }


# --- Artist Posts Endpoints ---
@app.get("/api/artists/{artist_identifier}/posts")
def get_artist_posts(artist_identifier: str):
    clean_id = artist_identifier.strip()
    posts = list(db["artist_posts"].find({
        "$or": [
            {"artist_name": {"$regex": f"^{re.escape(clean_id)}$", "$options": "i"}},
            {"artist_id": clean_id}
        ]
    }).sort("_id", -1))
    
    formatted = []
    for p in posts:
        formatted.append({
            "id": str(p["_id"]),
            "_id": str(p["_id"]),
            "artist_name": p.get("artist_name", clean_id),
            "text": p.get("text", ""),
            "category": p.get("category") or p.get("tag") or "Studio Update",
            "tag": p.get("category") or p.get("tag") or "Studio Update",
            "tags": p.get("tags", ""),
            "time": p.get("time", "Recently"),
            "created_at": str(p.get("created_at", ""))
        })
    return formatted

@app.post("/api/artists/{artist_identifier}/posts")
def create_artist_post(artist_identifier: str, post: dict):
    text = post.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Post text cannot be empty")
        
    new_doc = {
        "artist_name": post.get("artist_name") or artist_identifier,
        "text": text,
        "category": post.get("category") or post.get("tag") or "Studio Update",
        "tags": post.get("tags", ""),
        "created_at": post.get("createdAt") or post.get("created_at") or ""
    }
    result = db["artist_posts"].insert_one(new_doc)
    return {
        "id": str(result.inserted_id),
        "_id": str(result.inserted_id),
        **new_doc
    }

@app.delete("/api/artists/{artist_identifier}/posts/{post_id}")
def delete_artist_post(artist_identifier: str, post_id: str):
    try:
        query = {"_id": ObjectId(post_id)}
    except Exception:
        query = {"_id": post_id}
        
    result = db["artist_posts"].delete_one(query)
    if result.deleted_count == 0:
        # Fallback query if stored with string id
        db["artist_posts"].delete_one({"id": post_id})
        
    return {"status": "success", "message": "Post deleted successfully"}


# --- Artist Direct Chat Endpoints (Resilient & Flexible) ---
@app.get("/api/artists/{artist_identifier}/messages")
def get_artist_chat_messages(artist_identifier: str, user_email: str = ""):
    clean_artist = artist_identifier.strip()
    clean_target = re.sub(r'[^a-zA-Z0-9]', '', clean_artist)
    u_email = user_email.strip().lower() if user_email else ""
    
    query_filters = [
        {"artist_name": {"$regex": f"^{re.escape(clean_artist)}$", "$options": "i"}},
        {"artist_name": {"$regex": f".*{re.escape(clean_target)}.*", "$options": "i"}},
        {"artist_id": clean_artist}
    ]
    
    if u_email:
        query = {
            "$and": [
                {"$or": query_filters},
                {"user_email": u_email}
            ]
        }
    else:
        query = {"$or": query_filters}
        
    messages = list(db["artist_chats"].find(query).sort("_id", 1))
    
    user_cache = {}
    formatted = []
    for m in messages:
        iso_time = str(m.get("timestamp") or m.get("created_at") or "")
        sender = m.get("sender", "user")
        m_user_email = (m.get("user_email") or "").strip().lower()
        sender_name = (m.get("sender_name") or "").strip()
        sender_image = m.get("sender_image") or m.get("profile_pic") or ""

        # Fetch and cache user doc
        if m_user_email and m_user_email not in user_cache:
            user_cache[m_user_email] = users_collection.find_one({"email": m_user_email})
        u_doc = user_cache.get(m_user_email)

        if sender == "user" and u_doc:
            real_name = u_doc.get("name") or u_doc.get("artist_name")
            if real_name:
                sender_name = real_name
            if not sender_image:
                sender_image = u_doc.get("image") or u_doc.get("profile_pic") or ""
        elif sender == "artist":
            if not sender_image:
                art_doc = users_collection.find_one({
                    "$or": [
                        {"artist_name": {"$regex": f"^{re.escape(clean_artist)}$", "$options": "i"}},
                        {"name": {"$regex": f"^{re.escape(clean_artist)}$", "$options": "i"}}
                    ]
                })
                if art_doc:
                    sender_image = art_doc.get("image") or art_doc.get("profile_pic") or ""

        if not sender_name or "@" in sender_name:
            if u_doc and (u_doc.get("name") or u_doc.get("artist_name")):
                sender_name = u_doc.get("name") or u_doc.get("artist_name")
            elif "@" in sender_name:
                sender_name = sender_name.split("@")[0].replace(".", " ").replace("-", " ").title()
            else:
                sender_name = "User"

        formatted.append({
            "id": str(m["_id"]),
            "_id": str(m["_id"]),
            "artist_name": m.get("artist_name", clean_artist),
            "user_email": m_user_email or "listener@sway.com",
            "sender": sender,
            "sender_name": sender_name,
            "sender_image": sender_image,
            "profile_pic": sender_image,
            "text": m.get("text", ""),
            "time": m.get("time", "Just now"),
            "timestamp": iso_time,
            "created_at": iso_time
        })
    return formatted

@app.post("/api/artists/{artist_identifier}/messages")
def send_artist_chat_message(artist_identifier: str, msg: dict):
    clean_artist = artist_identifier.strip()
    text = msg.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message text cannot be empty")
        
    user_email = (msg.get("user_email") or "").strip().lower() or "listener@sway.com"
    sender = msg.get("sender") or "user"
    raw_sender_name = (msg.get("sender_name") or "").strip()
    sender_image = msg.get("sender_image") or msg.get("profile_pic") or ""
    
    sender_doc = users_collection.find_one({"email": user_email}) if user_email else None
    
    if sender == "artist":
        sender_name = clean_artist
        artist_doc = users_collection.find_one({
            "$or": [
                {"artist_name": {"$regex": f"^{re.escape(clean_artist)}$", "$options": "i"}},
                {"name": {"$regex": f"^{re.escape(clean_artist)}$", "$options": "i"}}
            ]
        })
        if artist_doc:
            sender_name = artist_doc.get("artist_name") or artist_doc.get("name") or clean_artist
            sender_image = artist_doc.get("profile_pic") or artist_doc.get("image") or sender_image
    else:
        if sender_doc:
            sender_name = sender_doc.get("name") or sender_doc.get("artist_name") or raw_sender_name
            sender_image = sender_doc.get("profile_pic") or sender_doc.get("image") or sender_image
        else:
            sender_name = raw_sender_name if (raw_sender_name and raw_sender_name.lower() != "you" and "@" not in raw_sender_name) else (user_email.split("@")[0].title() if "@" in user_email else "User")

    time_str = msg.get("time") or datetime.now(timezone.utc).strftime("%H:%M")
    iso_now = datetime.now(timezone.utc).isoformat()
    
    new_msg = {
        "artist_name": clean_artist,
        "user_email": user_email,
        "sender": sender,
        "sender_name": sender_name,
        "sender_image": sender_image,
        "profile_pic": sender_image,
        "text": text,
        "time": time_str,
        "read": False,
        "timestamp": iso_now,
        "created_at": iso_now
    }
    result = db["artist_chats"].insert_one(new_msg)
    
    return {
        "id": str(result.inserted_id),
        "_id": str(result.inserted_id),
        **new_msg
    }


# --- User All Conversations Endpoint ---
@app.get("/api/chats/user/{user_email}")
def get_user_conversations(user_email: str):
    clean_email = user_email.strip().lower() if user_email else ""
    if not clean_email:
        return []

    # 1. Fetch user profile to detect if user is an artist
    user_doc = users_collection.find_one({"email": clean_email})
    artist_names = []
    if user_doc:
        if user_doc.get("name"):
            artist_names.append(user_doc.get("name").strip())
        if user_doc.get("artist_name"):
            artist_names.append(user_doc.get("artist_name").strip())

    # 2. Find all messages where user is the listener OR user is the artist
    or_clauses = [{"user_email": clean_email}]
    for a_name in artist_names:
        or_clauses.append({"artist_name": {"$regex": f"^{re.escape(a_name)}$", "$options": "i"}})

    all_msgs = list(db["artist_chats"].find({"$or": or_clauses}).sort("_id", 1))

    # 3. Group into conversations by (artist_name, user_email)
    conversations_map = {}
    user_cache = {}
    artist_cache = {}

    for m in all_msgs:
        m_artist = (m.get("artist_name") or "").strip()
        m_listener_email = (m.get("user_email") or "").strip().lower()
        if not m_artist or not m_listener_email:
            continue

        thread_key = f"{m_artist.lower()}__{m_listener_email}"
        
        # Check whether the logged-in user is the artist in this thread
        is_logged_in_as_artist = any(m_artist.lower() == a.lower() for a in artist_names)

        # Determine other party's info
        if is_logged_in_as_artist:
            # Other party is the listener
            other_email = m_listener_email
            if other_email not in user_cache:
                user_cache[other_email] = users_collection.find_one({"email": other_email})
            u_info = user_cache.get(other_email)
            other_name = u_info.get("name") or u_info.get("artist_name") if u_info else ""
            if not other_name:
                sender_n = m.get("sender_name") if m.get("sender") == "user" else ""
                other_name = sender_n if (sender_n and sender_n.lower() != "you" and "@" not in sender_n) else (other_email.split("@")[0].title() if "@" in other_email else "User")
            other_image = u_info.get("profile_pic") or u_info.get("image") if u_info else ""
            if not other_image and m.get("sender") == "user":
                other_image = m.get("sender_image") or m.get("profile_pic") or ""
            other_role = "listener"
        else:
            # Other party is the artist
            other_name = m_artist
            if m_artist not in artist_cache:
                art_doc = users_collection.find_one({
                    "$or": [
                        {"artist_name": {"$regex": f"^{re.escape(m_artist)}$", "$options": "i"}},
                        {"name": {"$regex": f"^{re.escape(m_artist)}$", "$options": "i"}}
                    ]
                })
                artist_cache[m_artist] = art_doc
            art_doc = artist_cache.get(m_artist)
            other_image = art_doc.get("profile_pic") or art_doc.get("image") if art_doc else ""
            if not other_image:
                other_image = m.get("sender_image") if m.get("sender") == "artist" else ""
            other_role = "artist"

        iso_time = str(m.get("timestamp") or m.get("created_at") or "")

        conversations_map[thread_key] = {
            "id": thread_key,
            "artist_name": m_artist,
            "listener_email": m_listener_email,
            "is_artist_view": is_logged_in_as_artist,
            "other_name": other_name,
            "other_image": other_image,
            "other_role": other_role,
            "last_message": m.get("text", ""),
            "last_time": m.get("time", "Recently"),
            "timestamp": iso_time,
            "unread": not m.get("read", False) and (
                (is_logged_in_as_artist and m.get("sender") == "user") or
                (not is_logged_in_as_artist and m.get("sender") == "artist")
            )
        }

    threads_list = list(conversations_map.values())
    threads_list.sort(key=lambda t: t.get("timestamp") or "", reverse=True)
    return threads_list


# --- User Notifications Endpoints ---
@app.get("/api/notifications")
def get_user_notifications(user_email: str = ""):
    if not user_email or not user_email.strip():
        return []
        
    clean_email = user_email.strip().lower()
    
    # 1. Find user profile to detect if they are an artist
    user_doc = users_collection.find_one({"email": clean_email})
    artist_names = []
    if user_doc:
        if user_doc.get("name"):
            artist_names.append(user_doc.get("name"))
        if user_doc.get("artist_name"):
            artist_names.append(user_doc.get("artist_name"))
            
    # 2. Build notification query:
    or_clauses = [
        {"user_email": clean_email, "sender": "artist"}
    ]
    for a_name in artist_names:
        or_clauses.append({"artist_name": {"$regex": f"^{re.escape(a_name)}$", "$options": "i"}, "sender": "user"})
        
    notifs = list(db["artist_chats"].find({"$or": or_clauses}).sort("_id", -1).limit(10))
    
    user_cache = {}
    artist_cache = {}
    formatted = []
    for n in notifs:
        sender = n.get("sender")
        n_user_email = (n.get("user_email") or "").strip().lower()
        sender_name = (n.get("sender_name") or "").strip()
        sender_image = n.get("sender_image") or n.get("profile_pic") or ""

        if sender == "user" and n_user_email:
            if n_user_email not in user_cache:
                user_cache[n_user_email] = users_collection.find_one({"email": n_user_email})
            u_info = user_cache.get(n_user_email)
            if u_info:
                sender_name = u_info.get("name") or u_info.get("artist_name") or sender_name
                sender_image = u_info.get("profile_pic") or u_info.get("image") or sender_image
        elif sender == "artist":
            a_name = n.get("artist_name")
            if a_name:
                if a_name not in artist_cache:
                    artist_cache[a_name] = users_collection.find_one({
                        "$or": [
                            {"artist_name": {"$regex": f"^{re.escape(a_name)}$", "$options": "i"}},
                            {"name": {"$regex": f"^{re.escape(a_name)}$", "$options": "i"}}
                        ]
                    })
                art_doc = artist_cache.get(a_name)
                if art_doc:
                    sender_name = art_doc.get("artist_name") or art_doc.get("name") or a_name
                    sender_image = art_doc.get("profile_pic") or art_doc.get("image") or sender_image
        
        if not sender_name or "@" in sender_name:
            if "@" in sender_name:
                sender_name = sender_name.split("@")[0].replace(".", " ").replace("-", " ").title()
            else:
                sender_name = "User"

        formatted.append({
            "id": str(n["_id"]),
            "_id": str(n["_id"]),
            "artist_name": n.get("artist_name"),
            "sender_name": sender_name,
            "sender_image": sender_image,
            "profile_pic": sender_image,
            "user_email": n_user_email,
            "sender_email": n_user_email,
            "sender": sender,
            "text": n.get("text", ""),
            "time": n.get("time", "Recently"),
            "read": n.get("read", False),
            "unread": not n.get("read", False)
        })
        
    return formatted

@app.post("/api/notifications/clear")
def clear_user_notifications(payload: dict):
    user_email = (payload.get("user_email") or "").strip().lower()
    if user_email:
        db["artist_chats"].update_many(
            {"$or": [{"user_email": user_email}, {"sender": "artist"}]},
            {"$set": {"read": True}}
        )
    return {"status": "success", "message": "Notifications cleared"}