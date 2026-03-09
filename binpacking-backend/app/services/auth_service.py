

from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import HTTPException, status
from jose import JWTError, jwt
import os
from dotenv import load_dotenv


load_dotenv()


SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError(
        "CRITICAL ERROR: JWT_SECRET_KEY not found in .env file!\n"
        "Please add JWT_SECRET_KEY to your .env file and restart the application."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10

# Single Admin User - PLAIN TEXT for testing (we'll hash later)
ADMIN_USER = {
    "id": "admin_001",
    "username": "avionAdm",
    "email": "admin@binpacking.com",
    "full_name": "System Administrator",
    "password": "avionAdm123!",  # Plain text for testing
    "is_active": True,
    "is_superuser": True,
    "role": "super_admin"
}

# JWT Token functions
def create_access_token(data: Dict[str, Any]) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # Assert that SECRET_KEY is not None
    assert SECRET_KEY is not None, "SECRET_KEY cannot be None"
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify JWT token"""
    try:
        # Assert that SECRET_KEY is not None
        assert SECRET_KEY is not None, "SECRET_KEY cannot be None"
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except (JWTError, AssertionError) as e:
        print(f"Token decode error: {e}")
        return None

# Main Auth Service Class
class AuthService:
    """Simplified authentication service"""
    
    def __init__(self):
        self.admin_user = ADMIN_USER
        self.admin_username = ADMIN_USER["username"]
        self.admin_password = ADMIN_USER["password"]
        print("✓ Auth Service Initialized")
        print(f"✓ Admin Username: {self.admin_username}")
        print(f"✓ Using SECRET_KEY from .env file")
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Simple direct password comparison"""
        if username == self.admin_username and password == self.admin_password:
            return {
                "id": self.admin_user["id"],
                "username": self.admin_user["username"],
                "email": self.admin_user["email"],
                "full_name": self.admin_user["full_name"],
                "is_active": self.admin_user["is_active"],
                "is_superuser": self.admin_user["is_superuser"],
                "role": self.admin_user["role"]
            }
        return None
    
    def login(self, username: str, password: str) -> Dict[str, Any]:
        """Login admin user"""
        user = self.authenticate_user(username, password)
        
        if not user:
            print(f"Login failed for username: {username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
        access_token = create_access_token(
            data={
                "sub": user["username"],
                "id": user["id"],
                "role": user["role"]
            }
        )
        
        print(f"✓ Login successful for: {username}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": user
        }
    
    def get_current_user(self, token: str) -> Dict[str, Any]:
        """Get current user from token"""
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
        # Decode token
        payload = decode_token(token)
        if payload is None:
            print("Token decode failed")
            raise credentials_exception
        
        # Check expiration
        exp = payload.get("exp")
        if exp and datetime.utcnow() > datetime.fromtimestamp(exp):
            print("Token expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get username
        username = payload.get("sub")
        if not isinstance(username, str) or username != self.admin_username:
            print(f"Username mismatch: {username}")
            raise credentials_exception
        
        return {
            "id": self.admin_user["id"],
            "username": self.admin_user["username"],
            "email": self.admin_user["email"],
            "full_name": self.admin_user["full_name"],
            "role": self.admin_user["role"],
            "is_superuser": self.admin_user["is_superuser"]
        }

# Create global instance
auth_service = AuthService()