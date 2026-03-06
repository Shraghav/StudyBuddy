import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from repository.database import Base
from sqlalchemy import (Column, DateTime, Enum, ForeignKey, Integer, LargeBinary, String,Text)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    documents = relationship("Document", back_populates="owner", cascade="all, delete")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete")
    quiz_sessions = relationship("QuizSession", back_populates="user", cascade="all, delete")

class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    size = Column(Integer)
    upload_date = Column(DateTime, default=lambda: datetime.utcnow())
    file_content = Column(LargeBinary, nullable=False)
    owner = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="document", cascade="all, delete")
    quiz_sessions = relationship("QuizSession", back_populates="document")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"))
    text_content = Column(Text, nullable=False)
    embedding = Column(Vector(3072)) 
    content_hash = Column(String(32), index=True, unique=True)

    document = relationship("Document", back_populates="chunks")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    user = relationship("User", back_populates="chat_sessions")
    document = relationship("Document", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"))
    sender = Column(Enum("user", "ai", name="sender_enum"), nullable=False)
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    session = relationship("ChatSession", back_populates="messages")

class QuizSession(Base):
    __tablename__ = "quiz_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    title = Column(String, nullable=False)
    status = Column(Enum("setup", "active", "completed", name="quiz_status_enum"), default="setup")
    setup_params = Column(JSONB, nullable=False, default={}) 
    score = Column(Integer, default=0)
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="quiz_sessions")
    document = relationship("Document", back_populates="quiz_sessions")
    questions = relationship("QuizQuestion", back_populates="quiz_session", cascade="all, delete-orphan")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_session_id = Column(UUID(as_uuid=True), ForeignKey("quiz_sessions.id"))
    text = Column(Text, nullable=False)
    type = Column(Enum("mcq", "text", name="question_type_enum"), nullable=False)
    options = Column(JSONB, nullable=True)  
    correct_answer = Column(String, nullable=False)
    user_answer = Column(String, nullable=True) 
    
    quiz_session = relationship("QuizSession", back_populates="questions")