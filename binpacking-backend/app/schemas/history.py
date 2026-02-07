from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


class HistoryEntry(BaseModel):

    
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    job_id: uuid.UUID
    job_name: str
    action: str
    action_details: Optional[Dict[str, Any]]
    performed_at: datetime
    efficiency: Optional[float]


class HistoryFilter(BaseModel):

    
    model_config = ConfigDict(from_attributes=True)
    
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    actions: Optional[List[str]] = None
    min_efficiency: Optional[float] = Field(None, ge=0, le=100)
    max_efficiency: Optional[float] = Field(None, ge=0, le=100)
    job_name_contains: Optional[str] = None