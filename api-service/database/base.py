import os
from dotenv import load_dotenv

from .database import Database
from playground_client.exceptions import NotFoundException

load_dotenv()

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    raise NotFoundException("Supabase credentials not found")

db = Database(url, key)
