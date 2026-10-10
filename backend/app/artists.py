import os
import boto3
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pymongo import MongoClient
from dotenv import load_dotenv
import bcrypt

load_dotenv()

router = APIRouter()

# MongoDB Configuration using environment variables exclusively
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("DATABASE_NAME", "Sway")

client = MongoClient(MONGO_URI)
db = client[MONGO_DB_NAME]
users_collection = db["users"]
artists_collection = db["artists"]

# Cloudflare R2 Configuration using environment variables exclusively
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_PUBLIC_DOMAIN = os.getenv("R2_PUBLIC_DOMAIN")

if not R2_PUBLIC_DOMAIN:
    raise RuntimeError("R2_PUBLIC_DOMAIN is not set in the environment variables.")

s3_client = boto3.client(
    's3',
    endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name="auto"
)

@router.get("/artists", response_model=list)
@router.get("/api/artists", response_model=list)
async def get_artists():
    try:
        artists = []
        for artist in artists_collection.find():
            artists.append({
                "_id": str(artist.get("_id")),
                "name": artist.get("name") or artist.get("artist_name"),
                "genre": artist.get("genre"),
                "image_url": artist.get("image_url") or artist.get("image") or artist.get("cover_art_url"),
                "alt": artist.get("alt") or f"Portrait of {artist.get('name', 'Artist')}"
            })
        return artists
    except Exception as e:
        print(f"Error fetching artists: {e}")
        raise HTTPException(status_code=500, detail="Internal server error while fetching artists")

@router.post("/api/signup/artist")
async def register_artist(
    name: str = Form(...),
    genre: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        existing_user = users_collection.find_one({"email": email})
        if existing_user:
            raise HTTPException(status_code=400, detail="An account with this email already exists.")

        file_extension = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
        file_name = f"artists/{email.replace('@', '_')}_profile.{file_extension}"
        
        s3_client.upload_fileobj(
            file.file,
            R2_BUCKET_NAME,
            file_name,
            ExtraArgs={"ContentType": file.content_type}
        )
        
        image_url = f"{R2_PUBLIC_DOMAIN.rstrip('/')}/{file_name}"

        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]

        hashed_password = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

        user_doc = {
            "name": name,
            "email": email,
            "password": hashed_password,
            "role": "artist",
            "image": image_url,
            "genre": genre
        }
        user_result = users_collection.insert_one(user_doc)

        artist_doc = {
            "user_id": str(user_result.inserted_id),
            "name": name,
            "genre": genre,
            "email": email,
            "image_url": image_url,
            "alt": f"Portrait of {name}"
        }
        artist_result = artists_collection.insert_one(artist_doc)
        
        return {
            "success": True,
            "message": "Artist account registered successfully",
            "user_id": str(user_result.inserted_id),
            "artist_id": str(artist_result.inserted_id),
            "image_url": image_url
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error during artist signup: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/signup/listener")
async def register_listener(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...)
):
    try:
        existing_user = users_collection.find_one({"email": email})
        if existing_user:
            raise HTTPException(status_code=400, detail="An account with this email already exists.")

        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]

        hashed_password = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

        user_doc = {
            "name": name,
            "email": email,
            "password": hashed_password,
            "role": "listener"
        }
        user_result = users_collection.insert_one(user_doc)

        return {
            "success": True,
            "message": "Listener account registered successfully",
            "user_id": str(user_result.inserted_id)
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error during listener signup: {e}")
        raise HTTPException(status_code=500, detail=str(e))