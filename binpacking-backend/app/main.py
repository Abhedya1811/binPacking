"""
Main FastAPI application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import packing, auth, history

app = FastAPI(
    title="3D Bin Packing API",
    description="API for 3D bin packing calculations and visualization",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(packing.router, prefix="/api/packing", tags=["Packing"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(history.router, prefix="/api/history", tags=["History"])


@app.get("/")
async def root():
    """
    Root endpoint
    """
    return {
        "message": "3D Bin Packing API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "packing": "/api/packing",
            "auth": "/api/auth",
            "history": "/api/history"
        }
    }


@app.get("/api/health")
async def api_health():
    """
    Overall API health check
    """
    return {
        "status": "healthy",
        "services": {
            "api": "operational",
            "packing": "available",
            "auth": "available",
            "history": "available"
        },
        "timestamp": "2024-01-26T16:00:00Z"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)