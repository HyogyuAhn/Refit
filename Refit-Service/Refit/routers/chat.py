from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime
import uuid
import secrets

from ..models import ApiKey, ChatSession, ChatMessage, User
from ..schemas import (
    ChatSessionCreate, 
    ChatSessionResponse, 
    ChatSessionUpdate,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatMessageUpdate
)
from ..database import get_db
from ..dependencies import oauth2_scheme, get_current_user, verify_token_hash
from ..utils import ErrorResponse

router = APIRouter(
    prefix="/api/chat", 
    tags=["chat"],
    responses={404: {"description": "Not found"}}
)

_STATIC_CATEGORIES = [
    "결제",
    "환불",
    "배송",
    "기타"
]

@router.get("/categories")
async def get_categories(request: Request, db: Session = Depends(get_db)) -> list[str]:
    token = request.headers.get("X-API-Key")
    if not token:
        return _STATIC_CATEGORIES
        
    api_key = db.query(ApiKey).filter(ApiKey.token == token, ApiKey.is_active == True).first()
    if not api_key:
        return _STATIC_CATEGORIES
        
    user = db.query(User).filter(User.id == api_key.user_id).first()
    if not user or not user.categories:
        return _STATIC_CATEGORIES
    
    try:
        user_categories = user.categories.split(',') if isinstance(user.categories, str) else user.categories
        return [cat.strip() for cat in user_categories if cat.strip()]
    except Exception:
        return _STATIC_CATEGORIES


def generate_session_id() -> str:
    return str(uuid.uuid4())


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_chat_session(
    session_data: ChatSessionCreate,
    request: Request,
    db: Session = Depends(get_db)
):

    api_key: Optional[ApiKey] = None

    if session_data.api_key_id is not None:
        api_key = db.query(ApiKey).filter(
            ApiKey.id == session_data.api_key_id,
            ApiKey.is_active == True
        ).first()

    if api_key is None:
        token = request.headers.get("X-API-Key")
        if token:
            api_key = db.query(ApiKey).filter(
                ApiKey.token == token,
                ApiKey.is_active == True
            ).first()

    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 API 키입니다."
        )
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 API 키입니다."
        )
    
    try:
        session_id = generate_session_id()
        db_session = ChatSession(
            api_key_id=api_key.id,
            session_id=session_id,
            visitor_id=session_data.visitor_id,
            started_at=datetime.utcnow(),
            category=session_data.category,
            status="active"
        )
        
        db.add(db_session)
        db.commit()
        db.refresh(db_session)
        
        return db_session
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="채팅 세션 생성 중 오류가 발생했습니다."
        )


@router.get("/sessions/count")
async def get_chat_sessions_count(
    status: Optional[str] = None,
    category: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    api_key_ids = [key.id for key in api_keys]
    
    if not api_key_ids:
        return {"count": 0}
    
    query = db.query(ChatSession).filter(ChatSession.api_key_id.in_(api_key_ids))
    
    if status:
        query = query.filter(ChatSession.status == status)
    
    if category:
        query = query.filter(ChatSession.category == category)
    
    count = query.count()
    return {"count": count}

@router.get("/sessions", response_model=List[ChatSessionResponse])
async def get_chat_sessions(
    status: Optional[str] = None,
    category: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    api_key_ids = [key.id for key in api_keys]
    
    if not api_key_ids:
        return []
    
    query = db.query(ChatSession).filter(ChatSession.api_key_id.in_(api_key_ids))
    
    if status:
        query = query.filter(ChatSession.status == status)
    
    if category:
        query = query.filter(ChatSession.category == category)
    
    sessions = query.order_by(ChatSession.started_at.desc()).all()
    return sessions


@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_chat_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    api_keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    api_key_ids = [key.id for key in api_keys]
    
    session = db.query(ChatSession).filter(
        ChatSession.session_id == session_id,
        ChatSession.api_key_id.in_(api_key_ids)
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="채팅 세션을 찾을 수 없습니다."
        )
    
    return session


@router.put("/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_chat_session(
    session_id: str,
    session_update: ChatSessionUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    api_key_ids = [key.id for key in api_keys]
    
    session = db.query(ChatSession).filter(
        ChatSession.session_id == session_id,
        ChatSession.api_key_id.in_(api_key_ids)
    ).first()
    
    return await _update_chat_session(session, session_update, db)

@router.put("/sessions/{session_id}/api", response_model=ChatSessionResponse)
async def update_chat_session_with_api_key(
    session_id: str,
    session_update: ChatSessionUpdate,
    request: Request,
    token: str = None,
    db: Session = Depends(get_db)
):
    if not token:
        api_key_header = request.headers.get("X-API-Key")
        if not api_key_header:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API 키가 필요합니다."
            )
        token = api_key_header
            
    token_hash = verify_token_hash(token)
    api_key = db.query(ApiKey).filter(ApiKey.token_hash == token_hash).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 API 키입니다."
        )
        
    session = db.query(ChatSession).filter(
        ChatSession.session_id == session_id,
        ChatSession.api_key_id == api_key.id
    ).first()
    
    return await _update_chat_session(session, session_update, db)

async def _update_chat_session(
    session,
    session_update,
    db: Session
):
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="채팅 세션을 찾을 수 없습니다."
        )
    
    if session_update.category is not None:
        session.category = session_update.category
    
    if session_update.status is not None:
        session.status = session_update.status
        
        if session_update.status == "closed" and not session.ended_at:
            session.ended_at = datetime.utcnow()
    
    if session_update.ended_at is not None:
        session.ended_at = session_update.ended_at
        
        if not session.status or session.status != "closed":
            session.status = "closed"
    
    db.commit()
    db.refresh(session)
    
    return session

@router.post("/messages", response_model=ChatMessageResponse)
async def create_chat_message(
    message_data: ChatMessageCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(
        ChatSession.id == message_data.chat_session_id,
        ChatSession.status == "active"
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="활성화된 채팅 세션을 찾을 수 없습니다."
        )
    
    valid_sender_types = ["user", "bot", "business", "visitor"]
    if message_data.sender_type not in valid_sender_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 발신자 유형입니다."
        )
    
    try:
        db_message = ChatMessage(
            chat_session_id=session.id,
            sender_type=message_data.sender_type,
            content=message_data.content,
            sent_at=datetime.utcnow(),
            needs_review=message_data.needs_review if message_data.needs_review is not None else False,
            is_answered=False
        )
        
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        return db_message
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="메시지 저장 중 오류가 발생했습니다."
        )


@router.post("/sessions/{session_id}/messages", response_model=ChatMessageResponse)
async def create_session_message(
    session_id: str,
    message_data: dict,
    request: Request,
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(
        ChatSession.session_id == session_id,
        ChatSession.status == "active"
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="활성화된 채팅 세션을 찾을 수 없습니다."
        )
    
    content = message_data.get("content")
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="메시지 내용이 필요합니다."
        )
        
    sender_type = message_data.get("sender_type", "visitor")
    valid_sender_types = ["user", "bot", "business", "visitor"]
    if sender_type not in valid_sender_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 발신자 유형입니다."
        )
    
    try:
        db_message = ChatMessage(
            chat_session_id=session.id,
            sender_type=sender_type,
            content=content,
            sent_at=datetime.utcnow(),
            needs_review=message_data.get("needs_review", False),
            is_answered=False
        )
        
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        return db_message
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="메시지 저장 중 오류가 발생했습니다."
        )


@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def get_session_messages(
    session_id: str,
    limit: Optional[int] = 50,
    skip: Optional[int] = 0,
    db: Session = Depends(get_db),
    token: str = None,
    current_user = Depends(get_current_user)
):
    api_keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    api_key_ids = [key.id for key in api_keys]
    
    session = db.query(ChatSession).filter(
        ChatSession.session_id == session_id,
        ChatSession.api_key_id.in_(api_key_ids)
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="채팅 세션을 찾을 수 없습니다."
        )
    
    messages = db.query(ChatMessage).filter(
        ChatMessage.chat_session_id == session.id
    ).order_by(ChatMessage.sent_at.asc()).offset(skip).limit(limit).all()
    
    return messages


@router.get("/messages/unanswered", response_model=List[ChatMessageResponse])
async def get_unanswered_messages(
    limit: Optional[int] = 50,
    skip: Optional[int] = 0,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    api_keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    api_key_ids = [key.id for key in api_keys]
    
    if not api_key_ids:
        return []
    
    sessions_query = db.query(ChatSession).filter(ChatSession.api_key_id.in_(api_key_ids))
    
    if category:
        sessions_query = sessions_query.filter(ChatSession.category == category)
    
    sessions = sessions_query.all()
    session_ids = [session.id for session in sessions]
    
    if not session_ids:
        return []
    
    messages = db.query(ChatMessage).filter(
        ChatMessage.chat_session_id.in_(session_ids),
        ChatMessage.needs_review == True,
        ChatMessage.is_answered == False
    ).order_by(ChatMessage.sent_at.asc()).offset(skip).limit(limit).all()
    
    return messages


@router.put("/messages/{message_id}", response_model=ChatMessageResponse)
async def update_message(
    message_id: int,
    message_update: ChatMessageUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    message = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="메시지를 찾을 수 없습니다."
        )
    
    session = db.query(ChatSession).filter(ChatSession.id == message.chat_session_id).first()
    api_key = db.query(ApiKey).filter(ApiKey.id == session.api_key_id).first()
    
    if api_key.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 메시지를 업데이트할 권한이 없습니다."
        )
    
    if message_update.needs_review is not None:
        message.needs_review = message_update.needs_review
    
    if message_update.is_answered is not None:
        message.is_answered = message_update.is_answered
    
    db.commit()
    db.refresh(message)
    
    return message


from ..chatgpt import generate_chat_response, generate_fallback_response

@router.post("/sessions/{session_id}/respond", response_model=ChatMessageResponse)
async def generate_ai_response(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="채팅 세션을 찾을 수 없습니다."
        )
    
    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="활성화된 채팅 세션만 응답을 생성할 수 있습니다."
        )
    
    messages = db.query(ChatMessage).filter(
        ChatMessage.chat_session_id == session.id
    ).order_by(ChatMessage.sent_at.asc()).all()
    
    if not messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="응답할 메시지가 없습니다."
        )
    
    try:
        message_list = [
            {"sender_type": msg.sender_type, "content": msg.content}
            for msg in messages
        ]
        
        response_text = await generate_chat_response(
            message_list, 
            category=session.category
        )
        
        needs_review = False
        if not response_text or response_text.startswith("죄송합니다"):
            needs_review = True
        
        db_message = ChatMessage(
            chat_session_id=session.id,
            sender_type="bot",
            content=response_text,
            sent_at=datetime.utcnow(),
            needs_review=needs_review,
            is_answered=not needs_review
        )
        
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        api_key = db.query(ApiKey).filter(ApiKey.id == session.api_key_id).first()
        if api_key:
            api_key.request_count += 1
            api_key.last_used_at = datetime.utcnow()
            db.commit()
        
        return db_message
        
    except Exception as e:
        fallback_text = await generate_fallback_response()
        
        db_message = ChatMessage(
            chat_session_id=session.id,
            sender_type="bot",
            content=fallback_text,
            sent_at=datetime.utcnow(),
            needs_review=True,
            is_answered=False
        )
        
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        return db_message
