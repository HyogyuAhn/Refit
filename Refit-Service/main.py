from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn
import os

app = FastAPI(
    title="Refit",
    description="소상공인을 위한 AI 기반 고객 응답 자동화 서비스",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "Refit", "static")), name="static")

from Refit.routers import web
app.include_router(web.router, tags=["web"])

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
