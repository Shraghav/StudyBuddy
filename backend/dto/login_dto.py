from pydantic import BaseModel, EmailStr, Field

class GoogleAuthRequest(BaseModel):
    token: str
class AuthRequest(BaseModel):
    email:EmailStr
    password:str = Field(..., min_length=6, description = "Password must be 6 characters long")