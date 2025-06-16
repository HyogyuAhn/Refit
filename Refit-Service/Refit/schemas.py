from pydantic import BaseModel, Field, validator, EmailStr
import re
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    fullname: str
    business_name: str
    password: str = Field(..., min_length=8, max_length=16)
    password_confirm: str
    categories: List[str] = []
    
    @validator('password')
    def password_complexity(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('비밀번호는 최소 하나의 대문자를 포함해야 합니다')
        if not re.search(r'[a-z]', v):
            raise ValueError('비밀번호는 최소 하나의 소문자를 포함해야 합니다')
        if not re.search(r'[0-9]', v):
            raise ValueError('비밀번호는 최소 하나의 숫자를 포함해야 합니다')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('비밀번호는 최소 하나의 특수문자를 포함해야 합니다')
        return v
    
    @validator('password_confirm')
    def passwords_match(cls, v, values, **kwargs):
        if 'password' in values and v != values['password']:
            raise ValueError('비밀번호가 일치하지 않습니다')
        return v

class User(UserBase):
    id: int
    fullname: str
    business_name: str
    categories: str
    is_active: bool

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str
    remember_me: Optional[bool] = False
    auto_login: Optional[bool] = False

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None


class ApiKeyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class ApiKeyCreate(ApiKeyBase):
    user_password: str = Field(..., min_length=8)


class ApiKeyResponse(ApiKeyBase):
    id: int
    created_at: datetime
    last_used_at: Optional[datetime] = None
    is_active: bool
    request_count: int
    
    class Config:
        from_attributes = True


class ApiKeyDetail(ApiKeyResponse):
    token: str


class ApiKeyUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class ApiRequestBase(BaseModel):
    api_key_id: int
    endpoint: str


class ApiRequestCreate(ApiRequestBase):
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    response_status: Optional[int] = None
    processing_time: Optional[float] = None


class ApiRequestResponse(ApiRequestBase):
    id: int
    request_time: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    response_status: Optional[int] = None
    processing_time: Optional[float] = None
    
    class Config:
        from_attributes = True


class ChatSessionBase(BaseModel):
    visitor_id: Optional[str] = None
    category: Optional[str] = None


class ChatSessionCreate(ChatSessionBase):
    api_key_id: Optional[int] = None


class ChatSessionResponse(ChatSessionBase):
    id: int
    session_id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    status: str
    
    class Config:
        from_attributes = True


class ChatSessionUpdate(BaseModel):
    category: Optional[str] = None
    status: Optional[str] = None
    ended_at: Optional[datetime] = None

class ChatMessageBase(BaseModel):
    chat_session_id: int
    sender_type: str
    content: str


class ChatMessageCreate(ChatMessageBase):
    needs_review: Optional[bool] = False


class ChatMessageResponse(ChatMessageBase):
    id: int
    sent_at: datetime
    needs_review: bool
    is_answered: bool
    
    class Config:
        from_attributes = True


class ChatMessageUpdate(BaseModel):
    needs_review: Optional[bool] = None
    is_answered: Optional[bool] = None
