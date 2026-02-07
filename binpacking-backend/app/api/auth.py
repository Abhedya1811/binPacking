# app/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Dict, Any, Optional

from app.services.auth_service import auth_service, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Request/Response models
class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: Dict[str, Any]

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class MessageResponse(BaseModel):
    message: str
    note: Optional[str] = None

@router.post("/login", response_model=LoginResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Admin login endpoint
    
    Username: admin
    Password: admin123
    """
    try:
        result = auth_service.login(form_data.username, form_data.password)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )

@router.post("/logout")
async def logout(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Logout endpoint (client-side token invalidation)
    """
    return {"message": "Logged out successfully"}

@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    request: ChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Change admin password
    """
    token = None
    if isinstance(current_user, dict):
        token = current_user.get("token") or current_user.get("access_token")
    if not token or not isinstance(token, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid token for password change"
        )
    return auth_service.change_password(
        current_password=request.current_password,
        new_password=request.new_password,
        token=token
    )

@router.get("/profile")
async def get_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Get admin user profile
    """
    token = None
    if isinstance(current_user, dict):
        token = current_user.get("token") or current_user.get("access_token")
    if not token or not isinstance(token, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid token for profile retrieval"
        )
    return auth_service.get_user_profile(token)

@router.get("/verify")
async def verify_token(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Verify token validity
    """
    return {
        "valid": True,
        "user": current_user,
        "message": "Token is valid"
    }

# Health check endpoint (no auth required)
@router.get("/health")
async def health_check():
    """
    Authentication service health check
    """
    return {
        "status": "healthy",
        "service": "auth",
        "auth_type": "static_admin",
        "admin_user": "admin",
        "requires_db": False
    }