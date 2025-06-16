from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
import os

from ..database import get_db
from ..security import get_current_user_optional

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

@router.get("/", response_class=HTMLResponse)
async def read_home(request: Request, db: Session = Depends(get_db)):
    user = await get_current_user_optional(db, request)
    return templates.TemplateResponse("index.html", {"request": request, "user": user})

@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, db: Session = Depends(get_db)):
    user = await get_current_user_optional(db, request)
    return templates.TemplateResponse("dashboard_home.html", {"request": request, "user": user})

@router.get("/dashboard/profile", response_class=HTMLResponse)
async def dashboard_profile(request: Request, db: Session = Depends(get_db)):
    user = await get_current_user_optional(db, request)
    return templates.TemplateResponse("dashboard_profile.html", {"request": request, "user": user})

@router.get("/dashboard/api-management", response_class=HTMLResponse)
async def dashboard_api_management(request: Request, db: Session = Depends(get_db)):
    user = await get_current_user_optional(db, request)
    return templates.TemplateResponse("dashboard_api_management.html", {"request": request, "user": user})

@router.get("/dashboard/chat-sessions", response_class=HTMLResponse)
async def dashboard_chat_sessions(request: Request, db: Session = Depends(get_db)):
    user = await get_current_user_optional(db, request)
    return templates.TemplateResponse("dashboard_chat.html", {"request": request, "user": user})

@router.get("/dashboard/faq", response_class=HTMLResponse)
async def dashboard_faq(request: Request, db: Session = Depends(get_db)):
    user = await get_current_user_optional(db, request)
    return templates.TemplateResponse("dashboard_faq.html", {"request": request, "user": user})

@router.get("/dashboard/user-analysis", response_class=HTMLResponse)
async def dashboard_user_analysis(request: Request, db: Session = Depends(get_db)):
    user = await get_current_user_optional(db, request)
    return templates.TemplateResponse("dashboard_user_analysis.html", {"request": request, "user": user})

@router.get("/dashboard/statistics", response_class=HTMLResponse)
async def dashboard_statistics(request: Request, db: Session = Depends(get_db)):
    user = await get_current_user_optional(db, request)
    return templates.TemplateResponse("dashboard_statistics.html", {"request": request, "user": user})

@router.get("/dashboard/chat-sessions", response_class=HTMLResponse)
async def dashboard_chat_sessions(request: Request, db: Session = Depends(get_db)):
    user = await get_current_user_optional(db, request)
    return templates.TemplateResponse("dashboard_chat_sessions.html", {"request": request, "user": user})