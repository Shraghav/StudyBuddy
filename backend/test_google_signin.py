from datetime import datetime, timedelta, timezone

import jwt
from dto.login_dto import GoogleAuthRequest
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from repository.database import get_async_session
from repository.models import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

GOOGLE_WEB_CLIENT_ID = "Webclientid" 
JWT_SECRET = "super_secret_key"
JWT_ALGORITHM = "HS256"

router = APIRouter(prefix="/login", tags=["Login"])
security = HTTPBearer()

@router.post("/auth/google")
async def google_auth(data: GoogleAuthRequest, db: AsyncSession = Depends(get_async_session)):
    token = data.token
    if not token:
        raise HTTPException(status_code=400, detail="Token missing")

    try:
        # 1. Verify token with Google
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_WEB_CLIENT_ID)
        email = idinfo['email']

        # 2. Find or Create User in Postgres
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            user = User(email=email) 
            db.add(user)
            await db.commit() 
            await db.refresh(user)

        # 3. Create your own JWT
        expire = datetime.now(timezone.utc) + timedelta(days=7)
        jwt_payload = {"sub": str(user.id), "exp": expire}
        access_token = jwt.encode(jwt_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        return {"access_token": access_token, "user_id": str(user.id), "email": user.email}

    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

@router.get("/me")
async def get_my_profile(
    credentials: HTTPAuthorizationCredentials = Depends(security), 
    db: AsyncSession = Depends(get_async_session)
):
    try:
        # Decode your custom JWT
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        user_id = payload.get("sub")
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "message": "Success!", 
            "email": user.email, 
            "created_at": user.created_at
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")