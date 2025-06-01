from sqlalchemy import Boolean, Column, String, Integer
from sqlalchemy.types import ARRAY
from sqlalchemy.ext.mutable import MutableList

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
