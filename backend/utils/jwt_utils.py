import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from utils.supabase_utils import supabase

load_dotenv()
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):  # noqa: B008
    """
    Validates the Supabase JWT token and extracts the user_id.
    Use this as a dependency on your protected routes.
    """
    try:
        # Step 1: Validate incoming bearer token against Supabase Auth service
        response = supabase.auth.get_user(credentials.credentials)
        # Step 2: Extract and return validated user UUID
        if response:
            return response.user.id
    except jwt.PyJWTError:
        # Step 3a: Raise 401 Unauthorized on invalid or expired token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    except Exception:
        # Step 3b: Re-raise unexpected authentication exceptions
        raise