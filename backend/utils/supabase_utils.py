import os

from dotenv import load_dotenv
from supabase import Client, create_client

# Step 1: Load environment variables for Supabase credentials
load_dotenv()
load_dotenv("backend/.env")

url: str = os.getenv("SUPABASE_URL", "")
key: str = os.getenv("SUPABASE_KEY", "")

# Step 2: Validate that required URL and API keys are present
if not url or not key:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables.")

# Step 3: Instantiate global Supabase Client for storage and database operations
supabase: Client = create_client(url, key)