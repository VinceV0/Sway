import os
import boto3
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv()

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "sway-audio-dev")

# Initialize S3 Client targeting Cloudflare R2 endpoint
s3_client = boto3.client(
    service_name="s3",
    endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    config=Config(signature_version="s3v4"),
    region_name="auto",
)

def get_audio_url(file_key: str) -> str:
    """
    Generates a pre-signed GET URL for streaming MP3s securely from R2.
    Valid for 1 hour (3600 seconds).
    """
    try:
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": R2_BUCKET_NAME, "Key": file_key},
            ExpiresIn=3600,
        )
        return url
    except Exception as e:
        print(f"Error generating R2 pre-signed URL: {e}")
        return ""