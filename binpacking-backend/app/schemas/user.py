

from pydantic import BaseModel, EmailStr, Field, validator, ConfigDict
from typing import Optional
from datetime import datetime
import uuid


class UserBase(BaseModel):
  
    model_config = ConfigDict(
        from_attributes=True,  
        populate_by_name=True   
    )
    
    email: EmailStr = Field(..., description="User email address")
    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    full_name: Optional[str] = Field(None, description="User's full name")


class UserCreate(UserBase):

    
    password: str = Field(..., min_length=8, description="User password")
    
    @validator('password')
    def validate_password(cls, v):
   
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        if not any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in v):
            raise ValueError('Password must contain at least one special character')
        return v


class UserResponse(UserBase):
  
    
    id: uuid.UUID
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: datetime


class UserUpdate(BaseModel):
 
    
    model_config = ConfigDict(from_attributes=True)
    
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)


class Token(BaseModel):
 
    
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
   
    
    model_config = ConfigDict(from_attributes=True)
    
    sub: str  # Subject (user email)
    id: str   # User ID
    exp: datetime  # Expiration time
    username: Optional[str] = None