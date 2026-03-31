from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import weight, performance
 
app = FastAPI(title="Wrestling App ML API", version="0.1.0")
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",        # Vite dev server
        "https://your-app.vercel.app",  # TODO: replace with your Vercel URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
app.include_router(weight.router, prefix="/predict", tags=["weight"])
app.include_router(performance.router, prefix="/predict", tags=["performance"])
 
 
@app.get("/health")
def health():
    return {"status": "ok"}