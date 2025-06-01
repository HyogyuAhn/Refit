from pydantic import BaseModel, Field, validator
import re
from typing import Optional, List

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
        orm_mode = True

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
