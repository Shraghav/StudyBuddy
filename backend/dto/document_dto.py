from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from uuid import UUID

class DocumentRenameRequest(BaseModel):
    new_name: str

class DocumentResponse(BaseModel):
    id: UUID
    name: str
    size: Optional[int] = 0
    upload_date: datetime

    class Config:
        from_attributes = True

class DocumentCreate(BaseModel):
    name: str
    file_url: str
    size: int