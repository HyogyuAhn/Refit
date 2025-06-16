from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Form
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import time
from fastapi.templating import Jinja2Templates
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from typing import Dict, Optional, List, Any
import os

from ..database import get_db
from .. import models, schemas, security

router = APIRouter()

async def get_form(request: Request) -> Dict[str, Any]:
    form_data = await request.form()
    return {key: value for key, value in form_data.items()}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))
@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

@router.post("/api/login")
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = Form(False),
    auto_login: bool = Form(False),
    db: Session = Depends(get_db)
):
    user = security.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 혹은 비밀번호가 올바르지 않아요.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    if auto_login:
        access_token_expires = timedelta(days=30)
        
    access_token = security.create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )
    
    response.set_cookie(
        key="access_token", 
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=30 * 24 * 60 * 60 if auto_login else None,
        expires=30 * 24 * 60 * 60 if auto_login else None
    )
    
    if remember_me:
        response.set_cookie(
            key="saved_username",
            value=user.username,
            max_age=30 * 24 * 60 * 60,
            httponly=False
        )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/api/register")
async def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    print(f"등록 시도: {user.dict()}")

    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="이미 존재하는 이름입니다.")
    
    db_email = db.query(models.User).filter(models.User.email == user.email).first()
    if db_email:
        raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다.")
    
    hashed_password = security.get_password_hash(user.password)
    
    categories_str = ",".join(user.categories) if user.categories else ""
    print(f"카테고리 데이터: {user.categories}")
    print(f"변환된 카테고리 문자열: {categories_str}")
    
    db_user = models.User(
        username=user.username,
        email=user.email,
        fullname=user.fullname,
        business_name=user.business_name,
        hashed_password=hashed_password,
        categories=categories_str
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"message": "회원가입에 성공했어요."}

@router.post("/api/check-username")
async def check_username(username: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if user:
        return {"available": False}
    return {"available": True}

class PasswordVerifyRequest(BaseModel):
    password: str
    
class UsernameCheckRequest(BaseModel):
    username: str

@router.post("/api/verify-password")
async def verify_password(request: Request, password_data: PasswordVerifyRequest, db: Session = Depends(get_db)):
    user = await security.get_current_user_optional(db, request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증되지 않은 사용자입니다.",
        )
    
    is_correct = security.verify_password(password_data.password, user.hashed_password)
    
    return {"success": is_correct}

class ProfileUpdateRequest(BaseModel):
    fullname: str
    business_name: Optional[str] = None
    new_password: Optional[str] = None
    categories: Optional[str] = None

@router.post("/api/update-profile")
async def update_profile(request: Request, profile_data: ProfileUpdateRequest, db: Session = Depends(get_db)):
    user = await security.get_current_user_optional(db, request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증되지 않은 사용자입니다.",
        )
    
    if user.fullname != profile_data.fullname:
        existing_user = db.query(models.User).filter(models.User.username == profile_data.fullname).first()
        if existing_user and existing_user.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 사용 중인 닉네임입니다.",
            )
    
    user.fullname = profile_data.fullname
    if profile_data.categories is not None:
        user.categories = profile_data.categories
    
    if profile_data.new_password:
        user.hashed_password = security.get_password_hash(profile_data.new_password)
    
    db.commit()
    db.refresh(user)
    
    return {"success": True, "message": "정보가 성공적으로 업데이트되었습니다."}

@router.get("/logout")
@router.post("/logout")
@router.get("/api/logout")
@router.post("/api/logout")
async def logout(request: Request, response: Response):
    response.delete_cookie(
        key="access_token", 
        path="/", 
        secure=False, 
        httponly=True, 
        samesite='lax'
    )

    response.set_cookie(key="access_token", value="", max_age=0, expires=0)

    timestamp = int(time.time())
    redirect_url = f"/?logout=true&t={timestamp}"

    redirect_response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    redirect_response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, private, max-age=0"
    redirect_response.headers["Pragma"] = "no-cache"
    redirect_response.headers["Expires"] = "0"
    redirect_response.headers["X-Logged-Out"] = "True"
    
    redirect_response.headers["Set-Cookie"] = "access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0"
    
    return redirect_response
