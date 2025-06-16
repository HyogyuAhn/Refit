from sqlalchemy import Boolean, Column, String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.types import ARRAY
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.orm import relationship
import datetime

from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    fullname = Column(String(100))
    business_name = Column(String(100))
    email = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(100))
    categories = Column(String(500))
    is_active = Column(Boolean, default=True)
    
    api_keys = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan")


class ApiKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(100), nullable=False)
    token = Column(String(64), unique=True, nullable=False)
    token_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    request_count = Column(Integer, default=0)
    
    user = relationship("User", back_populates="api_keys")
    chat_sessions = relationship("ChatSession", back_populates="api_key", cascade="all, delete-orphan")
    api_requests = relationship("ApiRequest", back_populates="api_key", cascade="all, delete-orphan")


class ApiRequest(Base):
    __tablename__ = "api_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"))
    request_time = Column(DateTime, default=datetime.datetime.utcnow)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    endpoint = Column(String(100), nullable=True)
    response_status = Column(Integer, nullable=True)
    processing_time = Column(Float, nullable=True)
    
    api_key = relationship("ApiKey", back_populates="api_requests")


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"))
    session_id = Column(String(64), unique=True, nullable=False)
    visitor_id = Column(String(64), nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    category = Column(String(100), nullable=True)
    status = Column(String(20), default="active", nullable=False)

    api_key = relationship("ApiKey", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="chat_session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_session_id = Column(Integer, ForeignKey("chat_sessions.id"))
    sender_type = Column(String(10), nullable=False)
    content = Column(Text, nullable=False)
    sent_at = Column(DateTime, default=datetime.datetime.utcnow)
    needs_review = Column(Boolean, default=False)
    is_answered = Column(Boolean, default=False)
    
    chat_session = relationship("ChatSession", back_populates="messages")
