from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

from Refit.database import engine
from Refit import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Refit",
    description="소상공인을 위한 AI 기반 고객 응답 자동화 서비스",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "Refit", "static")), name="static")

from Refit.routers import web, auth, apikey, chat, user
app.include_router(web.router, tags=["web"])
app.include_router(auth.router, tags=["auth"])
app.include_router(apikey.router, tags=["apikeys"])
app.include_router(apikey.dashboard_router, tags=["dashboard_apikeys"])
app.include_router(chat.router, tags=["chat"])
app.include_router(user.router, tags=["user"])

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
