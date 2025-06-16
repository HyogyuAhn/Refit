from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict
from sqlalchemy.orm import Session

from ..models import User, ApiKey, ChatSession
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(
    prefix="/api/user", 
    tags=["user"],
    responses={404: {"description": "Not found"}}
)

@router.get("/api-keys/status", response_model=Dict)
async def get_api_keys_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_keys = db.query(ApiKey).filter(
        ApiKey.user_id == current_user.id,
        ApiKey.is_active == True
    ).first()
    
    return {"has_api_keys": api_keys is not None}

@router.get("/chat/sessions/count", response_model=Dict)
async def get_chat_sessions_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    api_key_ids = [key.id for key in api_keys]
    
    if not api_key_ids:
        return {"count": 0}
    
    session_count = db.query(ChatSession).filter(
        ChatSession.api_key_id.in_(api_key_ids)
    ).count()
    
    return {"count": session_count}
