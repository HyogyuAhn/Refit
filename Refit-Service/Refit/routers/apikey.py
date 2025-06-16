from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta
import uuid
import secrets
import hashlib
import bcrypt

from ..models import ApiKey, ApiRequest, User
from ..schemas import (
    ApiKeyCreate,
    ApiKeyResponse,
    ApiKeyDetail,
    ApiKeyUpdate,
    ApiRequestCreate,
    ApiRequestResponse
)
from ..database import get_db
from ..dependencies import oauth2_scheme, get_current_user, verify_password
from ..utils import ErrorResponse

router = APIRouter(
    prefix="/api/apikeys", 
    tags=["apikeys"],
    responses={404: {"description": "Not found"}}
)

dashboard_router = APIRouter(
    prefix="/dashboard/api/apikeys", 
    tags=["dashboard_apikeys"],
    responses={404: {"description": "Not found"}}
)


def generate_api_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    hash_object = hashlib.sha256(token.encode())
    return hash_object.hexdigest()


@router.post("/", response_model=ApiKeyDetail, status_code=status.HTTP_201_CREATED)
@dashboard_router.post("/", response_model=ApiKeyDetail, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    key_create: ApiKeyCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(key_create.user_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="비밀번호가 일치하지 않습니다."
        )
    
    token = generate_api_token()
    token_hash = hash_token(token)
    
    try:
        db_api_key = ApiKey(
            user_id=current_user.id,
            name=key_create.name,
            token=token,
            token_hash=token_hash,
            created_at=datetime.utcnow()
        )
        db.add(db_api_key)
        db.commit()
        db.refresh(db_api_key)
        
        api_request = ApiRequest(
            api_key_id=db_api_key.id,
            endpoint="/api/apikeys/",
            request_time=datetime.utcnow(),
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent"),
            response_status=201
        )
        db.add(api_request)
        db.commit()
        
        return ApiKeyDetail(
            id=db_api_key.id,
            name=db_api_key.name,
            created_at=db_api_key.created_at,
            last_used_at=db_api_key.last_used_at,
            is_active=db_api_key.is_active,
            request_count=db_api_key.request_count,
            token=token
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API 키 생성 중 오류가 발생했습니다."
        )


@router.get("/", response_model=List[ApiKeyResponse])
async def get_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    return api_keys


@dashboard_router.get("/", response_model=List[ApiKeyResponse])
async def get_dashboard_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    return api_keys


@router.get("/{api_key_id}", response_model=ApiKeyResponse)
@dashboard_router.get("/{api_key_id}", response_model=ApiKeyResponse)
async def get_api_key(
    api_key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_key = db.query(ApiKey).filter(
        ApiKey.id == api_key_id,
        ApiKey.user_id == current_user.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API 키를 찾을 수 없습니다."
        )
    
    return api_key


# user_password를 받는 Class
class TokenRequestBody(BaseModel):
    user_password: str

@router.get("/{api_key_id}/token", response_model=ApiKeyDetail)
@dashboard_router.get("/{api_key_id}/token", response_model=ApiKeyDetail)
async def get_api_key_token_get(
    api_key_id: int,
    user_password: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return await _get_api_key_token(api_key_id, user_password, current_user, db)

@router.post("/{api_key_id}/token", response_model=ApiKeyDetail)
@dashboard_router.post("/{api_key_id}/token", response_model=ApiKeyDetail)
async def get_api_key_token_post(
    api_key_id: int,
    body: TokenRequestBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return await _get_api_key_token(api_key_id, body.user_password, current_user, db)

async def _get_api_key_token(
    api_key_id: int,
    user_password: str,
    current_user: User,
    db: Session
):
    if not verify_password(user_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="비밀번호가 일치하지 않습니다."
        )
    
    api_key = db.query(ApiKey).filter(
        ApiKey.id == api_key_id,
        ApiKey.user_id == current_user.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API 키를 찾을 수 없습니다."
        )
    
    return ApiKeyDetail(
        id=api_key.id,
        name=api_key.name,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
        is_active=api_key.is_active,
        request_count=api_key.request_count,
        token=api_key.token
    )


@router.put("/{api_key_id}", response_model=ApiKeyResponse)
@dashboard_router.put("/{api_key_id}", response_model=ApiKeyResponse)
async def update_api_key(
    api_key_id: int,
    key_update: ApiKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_key = db.query(ApiKey).filter(
        ApiKey.id == api_key_id,
        ApiKey.user_id == current_user.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API 키를 찾을 수 없습니다."
        )
    
    if key_update.name is not None:
        api_key.name = key_update.name
    
    if key_update.is_active is not None:
        api_key.is_active = key_update.is_active
    
    db.commit()
    db.refresh(api_key)
    
    return api_key


@router.delete("/{api_key_id}", status_code=status.HTTP_204_NO_CONTENT)
@dashboard_router.delete("/{api_key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    api_key_id: int,
    user_password: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(user_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="비밀번호가 일치하지 않습니다."
        )
    
    api_key = db.query(ApiKey).filter(
        ApiKey.id == api_key_id,
        ApiKey.user_id == current_user.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API 키를 찾을 수 없습니다."
        )
    
    db.delete(api_key)
    db.commit()
    
    return None


@router.post("/verify", response_model=ApiKeyResponse)
async def verify_api_key(
    request: Request,
    token: str,
    db: Session = Depends(get_db)
):
    token_hash = hash_token(token)
    
    api_key = db.query(ApiKey).filter(
        ApiKey.token_hash == token_hash,
        ApiKey.is_active == True
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 API 키입니다."
        )
    
    api_key.request_count += 1
    api_key.last_used_at = datetime.utcnow()
    
    api_request = ApiRequest(
        api_key_id=api_key.id,
        endpoint="/api/apikeys/verify",
        request_time=datetime.utcnow(),
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        response_status=200
    )
    
    db.add(api_request)
    db.commit()
    db.refresh(api_key)
    
    return api_key
