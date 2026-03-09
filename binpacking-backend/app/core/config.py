
from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
   
    
  
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Application
    DEBUG: bool = False
    PROJECT_NAME: str = "3D Bin Packing API"
    VERSION: str = "1.0.0"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8080"
    ]
    
    class Config:
        env_file = ".env"

settings = Settings()