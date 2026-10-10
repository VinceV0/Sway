import os
import motor.motor_asyncio
from dotenv import load_dotenv

load_dotenv()

MONGO_DETAILS = os.getenv("MONGO_URI")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS)

# Explicitly target the exact database name "Sway"
database = client["Sway"]  
tracks_collection = database.get_collection("tracks")