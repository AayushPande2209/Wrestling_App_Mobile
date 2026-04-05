import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import weight, performance

load_dotenv()

app = FastAPI(title="Wrestling App ML API", version="0.1.0")

_frontend_url = os.environ.get("FRONTEND_URL", "")
_origins = ["http://localhost:5173"]
if _frontend_url:
    _origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
app.include_router(weight.router, prefix="/predict", tags=["weight"])
app.include_router(performance.router, prefix="/predict", tags=["performance"])
 
 
@app.get("/health")
def health():
    return {"status": "ok"}