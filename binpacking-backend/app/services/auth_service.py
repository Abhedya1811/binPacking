"""
Authentication Service - Admin Only Version
No database required - single admin user only
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

# OAuth2 password bearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# SINGLE ADMIN USER ONLY
ADMIN_USER = {
    "id": "admin_001",
    "username": "admin",
    "email": "admin@binpacking.com",
    "full_name": "System Administrator",
    "hashed_password": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",  # "admin123"
    "is_active": True,
    "is_superuser": True,
    "role": "super_admin"
}

# JWT Settings
SECRET_KEY = "your-super-secret-key-for-3d-bin-packing-app-2024"  # Change in production!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours (for testing)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Password verification
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

# Generate password hash (for reference, not needed for login)
def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)

# Create JWT token
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

# Decode JWT token
def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

# Main Auth Service Class
class AuthService:
    """Authentication service with single admin user"""
    
    def __init__(self):
        # Set admin credentials
        self.admin_username = "admin"
        self.admin_password = "admin123"  # Default password
        
        # You can change these via environment variables if needed
        # import os
        # self.admin_username = os.getenv("ADMIN_USERNAME", "admin")
        # self.admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Authenticate admin user with static credentials
        
        Returns: User dict if authenticated, None otherwise
        """
        # Check if username is admin
        if username != self.admin_username:
            return None
        
        # Verify password (compare with hashed password in ADMIN_USER)
        if not verify_password(password, ADMIN_USER["hashed_password"]):
            return None
        
        # Return user info without password
        return {
            "id": ADMIN_USER["id"],
            "username": ADMIN_USER["username"],
            "email": ADMIN_USER["email"],
            "full_name": ADMIN_USER["full_name"],
            "is_active": ADMIN_USER["is_active"],
            "is_superuser": ADMIN_USER["is_superuser"],
            "role": ADMIN_USER["role"]
        }
    
    def login(self, username: str, password: str) -> Dict[str, Any]:
        """
        Login admin user and return access token
        
        Returns: {"access_token": "jwt_token", "token_type": "bearer", "user": user_info}
        """
        user = self.authenticate_user(username, password)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
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
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # seconds
            "user": user
        }
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Verify JWT token and return payload
        """
        return decode_token(token)
    
    def get_current_user(self, token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
        """
        Get current user from JWT token
        
        Use as dependency: current_user = Depends(auth_service.get_current_user)
        """
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
        # Decode token
        payload = self.verify_token(token)
        if payload is None:
            raise credentials_exception
        
        # Check if user is admin: ensure 'sub' exists and is a string
        sub = payload.get("sub")
        if not isinstance(sub, str):
            # missing or invalid subject
            raise credentials_exception
        username: str = sub
        if username != self.admin_username:
            raise credentials_exception
        
        # Return admin user info
        return {
            "id": ADMIN_USER["id"],
            "username": ADMIN_USER["username"],
            "email": ADMIN_USER["email"],
            "full_name": ADMIN_USER["full_name"],
            "role": ADMIN_USER["role"],
            "is_superuser": ADMIN_USER["is_superuser"]
        }
    
    def change_password(self, current_password: str, new_password: str, token: str) -> Dict[str, Any]:
        """
        Change admin password (in-memory only, resets on restart)
        
        Note: For permanent changes, you'd need to update the hashed_password in ADMIN_USER
        """
        # Verify current user
        current_user = self.get_current_user(token)
        
        # Verify current password
        if not verify_password(current_password, ADMIN_USER["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        # Generate new hashed password
        new_hashed_password = get_password_hash(new_password)
        
        # Update in-memory admin user (temporary)
        # Note: This change won't persist after server restart
        # For persistence, you'd need to write to a config file or use environment variables
        ADMIN_USER["hashed_password"] = new_hashed_password
        
        return {
            "message": "Password changed successfully",
            "note": "Change is temporary until server restart"
        }
    
    def get_user_profile(self, token: str) -> Dict[str, Any]:
        """
        Get admin user profile
        """
        current_user = self.get_current_user(token)
        return {
            "profile": current_user,
            "system_info": {
                "auth_type": "static_admin",
                "users_count": 1,
                "api_version": "1.0",
                "requires_db": False
            }
        }

# Create global instance
auth_service = AuthService()

# FastAPI Dependency for protected routes
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Dependency for getting current user in FastAPI routes"""
    return auth_service.get_current_user(token)

# Test function to verify setup
def test_auth():
    """Test the authentication system"""
    print("🔐 Testing Authentication System...")
    
    # Test login with correct credentials
    try:
        result = auth_service.login("admin", "admin123")
        print("✅ Login successful")
        print(f"   Token: {result['access_token'][:50]}...")
        print(f"   User: {result['user']['username']}")
        
        # Test token verification
        payload = auth_service.verify_token(result["access_token"])
        verified_sub = payload.get('sub') if isinstance(payload, dict) else None
        print(f"✅ Token verified: {verified_sub}")
        
        # Test get_current_user
        current_user = auth_service.get_current_user(result["access_token"])
        print(f"✅ Current user: {current_user['username']}")
        
        return True
    except Exception as e:
        print(f"❌ Authentication test failed: {e}")
        return False

# Run test if executed directly
if __name__ == "__main__":
    test_auth()