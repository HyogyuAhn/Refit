from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import os

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

@router.get("/", response_class=HTMLResponse)
async def read_home(request: Request):
    """
    메인 홈페이지를 반환합니다.
    """
    return templates.TemplateResponse("index.html", {"request": request})
