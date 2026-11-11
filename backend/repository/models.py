import uuid
from datetime import UTC, datetime

from dto.enums import QuizStatus
from pgvector.sqlalchemy import Vector
from repository.database import Base
from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship


# Step 1: Define reusable timestamp mixin for automatic audit trail
class TimestampMixin:
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(UTC), 
        onupdate=lambda: datetime.now(UTC), 
        nullable=False
    )

# Step 2: Define User entity managing system identity and relations
class User(Base):
    __tablename__ = "users"

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_email = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    documents = relationship("Document", back_populates="owner", cascade="all, delete")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete")
    quiz_sessions = relationship("QuizSession", back_populates="user", cascade="all, delete")

# Step 3: Define Document entity representing uploaded PDF/TXT files and status
class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    name = Column(String, nullable=False)
    upload_date = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))
    status = Column(String, default="Processing")
    file_url = Column(String, nullable=False)
    
    owner = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="document", cascade="all, delete")
    quiz_sessions = relationship("QuizSession", back_populates="document")

# Step 4: Define DocumentChunk entity storing dense vector embeddings (pgvector)
class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"))
    text_content = Column(Text, nullable=False)
    embedding = Column(Vector(3072)) 
    content_hash = Column(String(32), index=True)

    document = relationship("Document", back_populates="chunks")

# Step 5: Define ChatSession entity linking user queries to context documents
class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    user = relationship("User", back_populates="chat_sessions")
    document = relationship("Document", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

# Step 6: Define ChatMessage entity recording user queries and streaming AI responses
class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"))
    sender = Column(Enum("ai","user", name="sender_enum"), nullable=False)
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    session = relationship("ChatSession", back_populates="messages")

# Step 7: Define QuizSession entity managing quiz lifecycle, scoring, and parameters
class QuizSession(Base, TimestampMixin):
    __tablename__ = "quiz_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    status = Column(
        Enum(QuizStatus, name="quiz_status_enum"), 
        default=QuizStatus.setup,
    )
    setup_params = Column(JSONB, default={})
    score = Column(Integer, default=0)
    feedback = Column(Text, nullable=True)

    user = relationship("User", back_populates="quiz_sessions")
    document = relationship("Document", back_populates="quiz_sessions")
    questions = relationship("QuizQuestion", back_populates="quiz_session", cascade="all, delete-orphan")

# Step 8: Define QuizQuestion entity storing question text, options, and submission score
class QuizQuestion(Base, TimestampMixin):
    __tablename__ = "quiz_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_session_id = Column(UUID(as_uuid=True), ForeignKey("quiz_sessions.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    options = Column(JSONB, nullable=True) 
    correct_answer = Column(String, nullable=False)    
    user_answer = Column(String, nullable=True)
    evaluation_score = Column(Float, nullable=True) 
    evaluation_feedback = Column(Text, nullable=True)

    quiz_session = relationship("QuizSession", back_populates="questions")
