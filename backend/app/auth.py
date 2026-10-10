import os
import re
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from pymongo import MongoClient
import bcrypt
import boto3
from botocore.config import Config
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

router = APIRouter()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["Sway"]
users_collection = db["users"]

# --- Cloudflare R2 Configuration ---
s3_client = boto3.client(
    's3',
    endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID', '')}.r2.cloudflarestorage.com",
    aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID', ''),
    aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY', ''),
    config=Config(signature_version='s3v4')
)
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME', '')
R2_PUBLIC_URL = os.getenv('R2_PUBLIC_URL', 'https://pub-027373b3b40748be8272805554236499.r2.dev')

def upload_to_r2(file: UploadFile, email: str) -> str:
    try:
        if not file or not file.filename:
            return ""

        file_extension = file.filename.split(".")[-1] if file.filename else "jpg"
        file_name = f"profiles/{email.replace('@', '_')}_{os.urandom(4).hex()}.{file_extension}"
        
        s3_client.upload_fileobj(
            file.file,
            R2_BUCKET_NAME,
            file_name,
            ExtraArgs={"ContentType": file.content_type}
        )
        
        pub_url = R2_PUBLIC_URL.rstrip('/')
        final_url = f"{pub_url}/{file_name}"
        print("Generated R2 Public URL:", final_url)
        return final_url
    except Exception as e:
        print("R2 Upload Error during registration:", e)
        return ""

def validate_unique_user(email: str, name: str):
    clean_email = email.lower().strip()
    clean_name = name.strip()

    # 1. Check if email is already registered
    if users_collection.find_one({"email": clean_email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Check if name/artist name is already taken (case-insensitive & whitespace tolerant)
    if clean_name:
        name_regex = re.compile(rf"^\s*{re.escape(clean_name)}\s*$", re.IGNORECASE)
        existing_name = users_collection.find_one({
            "$or": [
                {"name": name_regex},
                {"artist_name": name_regex}
            ]
        })
        if existing_name:
            raise HTTPException(
                status_code=400, 
                detail="Duplicate name not allowed: An artist or user with this name already exists."
            )

@router.post("/signup/listener")
async def signup_listener(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form("listener"),
    file: Optional[UploadFile] = File(None)
):
    validate_unique_user(email, name)

    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    image_url = ""
    if file:
        image_url = upload_to_r2(file, email)

    user_doc = {
        "name": name.strip(),
        "artist_name": name.strip(),
        "email": email.lower().strip(),
        "password": hashed_password,
        "role": role,
        "image": image_url
    }

    users_collection.insert_one(user_doc)
    return {"success": True, "message": "Listener account created successfully"}

@router.post("/signup/artist")
async def signup_artist(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form("artist"),
    genre: str = Form(...),
    file: Optional[UploadFile] = File(None)
):
    validate_unique_user(email, name)

    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    image_url = ""
    if file:
        image_url = upload_to_r2(file, email)

    user_doc = {
        "name": name.strip(),
        "artist_name": name.strip(),
        "email": email.lower().strip(),
        "password": hashed_password,
        "role": role,
        "genre": genre,
        "image": image_url
    }

    users_collection.insert_one(user_doc)
    return {"success": True, "message": "Artist account created successfully"}

# --- Added Login Endpoint ---
class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
async def login(data: LoginRequest):
    user = users_collection.find_one({"email": data.email.lower().strip()})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    # Verify password against stored bcrypt hash
    is_valid = bcrypt.checkpw(data.password.encode('utf-8'), user["password"].encode('utf-8'))
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    return {
        "success": True,
        "message": "Login successful",
        "user": {
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "image": user.get("image", "")
        }
    }