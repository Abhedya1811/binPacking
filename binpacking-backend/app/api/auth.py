"""
Authentication API endpoints - Single Admin User
Uses centralized auth service
"""

from datetime import timedelta
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

from app.services.auth_service import auth_service

router = APIRouter()

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# ---------- Models ----------
class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: Dict[str, Any]

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    role: str
    is_superuser: bool

class MessageResponse(BaseModel):
    message: str
    details: Optional[Dict[str, Any]] = None

# ---------- Dependency ----------
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current user from JWT token"""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return auth_service.get_current_user(token)

# ---------- API Endpoints ----------
@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
 
    return auth_service.login(form_data.username, form_data.password)

@router.get("/user", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
  
    return current_user

@router.post("/refresh")
async def refresh_token(token: str = Depends(oauth2_scheme)):
  
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No token provided"
        )
    
    # Verify current token
    current_user = auth_service.get_current_user(token)
    
    # Create new token
    new_token = auth_service.login(
        current_user["username"], 
        "password_not_needed_for_refresh"  # This won't be used as we're using token verification
    )
    
    return {
        "access_token": new_token["access_token"],
        "token_type": "bearer",
        "expires_in": new_token["expires_in"]
    }



@router.post("/logout")
async def logout():
 
    return {
        "message": "Successfully logged out",
        "note": "Please discard your token on the client side"
    }

@router.get("/verify")
async def verify_token(current_user: dict = Depends(get_current_user)):
   
    return {
        "valid": True, 
        "user": current_user["username"]
    }