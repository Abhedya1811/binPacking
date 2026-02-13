"""
Authentication API endpoints - Single Admin User
"""
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

router = APIRouter()

# ---------- Models ----------
class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: Dict[str, Any]

class TokenData(BaseModel):
    username: Optional[str] = None

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

# ---------- Auth Configuration ----------
SECRET_KEY = "your-super-secret-key-for-3d-bin-packing-app-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# ---------- Single Admin User ----------
ADMIN_USER = {
    "id": "admin_001",
    "username": "admin",
    "email": "admin@binpacking.com",
    "full_name": "System Administrator",
    "hashed_password": pwd_context.hash("admin123"),  # Generate fresh hash
    "is_active": True,
    "is_superuser": True,
    "role": "super_admin"
}

# ---------- Helper Functions ----------
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)

def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate admin user"""
    if username != ADMIN_USER["username"]:
        return None
    if not verify_password(password, ADMIN_USER["hashed_password"]):
        return None
    return {
        "id": ADMIN_USER["id"],
        "username": ADMIN_USER["username"],
        "email": ADMIN_USER["email"],
        "full_name": ADMIN_USER["full_name"],
        "role": ADMIN_USER["role"],
        "is_superuser": ADMIN_USER["is_superuser"]
    }

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current user from JWT token"""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")  # FIX: Use Optional[str]
        
        if username is None:
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    
    if username != ADMIN_USER["username"]:
        raise credentials_exception
    
    return {
        "id": ADMIN_USER["id"],
        "username": ADMIN_USER["username"],
        "email": ADMIN_USER["email"],
        "full_name": ADMIN_USER["full_name"],
        "role": ADMIN_USER["role"],
        "is_superuser": ADMIN_USER["is_superuser"]
    }

# ---------- API Endpoints ----------
@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login endpoint for admin user
    
    - **username**: admin
    - **password**: admin123
    """
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user["username"],
            "id": user["id"],
            "email": user["email"],
            "role": user["role"]
        },
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user
    }

@router.get("/user", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information
    """
    return current_user

@router.post("/refresh")
async def refresh_token(token: str = Depends(oauth2_scheme)):
    """
    Refresh access token using refresh token
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No token provided"
        )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")  # FIX: Use Optional[str]
        
        if username is None or username != ADMIN_USER["username"]:
            raise HTTPException(status_code=401, detail="Invalid user")
        
        new_token = create_access_token(
            data={
                "sub": username,
                "id": ADMIN_USER["id"],
                "email": ADMIN_USER["email"],
                "role": ADMIN_USER["role"]
            }
        )
        return {"access_token": new_token, "token_type": "bearer"}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_user)
):
    """
    Change admin password
    """
    if not verify_password(password_data.current_password, ADMIN_USER["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Update password
    ADMIN_USER["hashed_password"] = get_password_hash(password_data.new_password)
    
    return {
        "message": "Password changed successfully",
        "note": "Password has been updated"
    }

@router.post("/logout")
async def logout():
    """
    Logout endpoint
    """
    return {"message": "Successfully logged out"}

@router.get("/verify")
async def verify_token(current_user: dict = Depends(get_current_user)):
    """
    Verify if token is valid
    """
    return {"valid": True, "user": current_user["username"]}