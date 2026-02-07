"""
History API endpoints - Memory-based version
No database required
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid

from pydantic import BaseModel

router = APIRouter(prefix="/api/history", tags=["History"])

# In-memory storage for history
_in_memory_history = []


class HistoryEntry(BaseModel):
    """History entry schema"""
    id: str
    timestamp: datetime
    action: str
    user: str
    details: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None


class HistoryFilter(BaseModel):
    """History filter criteria"""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    actions: Optional[List[str]] = None
    user: Optional[str] = None


@router.get("/", response_model=List[HistoryEntry])
def get_history(
    start_date: Optional[datetime] = Query(None, description="Start date for filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering"),
    action: Optional[str] = Query(None, description="Filter by specific action"),
    skip: int = 0,
    limit: int = 50,
):
    """
    Get packing history from memory
    """
    # Filter history
    filtered_history = _in_memory_history.copy()
    
    # Apply date filters
    if start_date:
        filtered_history = [h for h in filtered_history if h["timestamp"] >= start_date]
    if end_date:
        filtered_history = [h for h in filtered_history if h["timestamp"] <= end_date]
    
    # Apply action filter
    if action:
        filtered_history = [h for h in filtered_history if h["action"] == action]
    
    # Apply pagination
    paginated_history = filtered_history[skip:skip + limit]
    
    return paginated_history


@router.post("/add", response_model=HistoryEntry)
def add_history_entry(
    action: str,
    details: Dict[str, Any],
    user: str = "admin",
    result: Optional[Dict[str, Any]] = None
):
    """
    Add a new history entry
    """
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.utcnow(),
        "action": action,
        "user": user,
        "details": details,
        "result": result
    }
    
    _in_memory_history.insert(0, entry)  # Add to beginning
    
    # Keep only last 1000 entries
    if len(_in_memory_history) > 1000:
        _in_memory_history.pop()
    
    return entry


@router.get("/stats")
def get_history_stats(
    days: int = Query(30, description="Number of days to include in statistics"),
):
    """
    Get statistics about packing history
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Filter recent entries
    recent_history = [
        h for h in _in_memory_history 
        if h["timestamp"] >= cutoff_date
    ]
    
    # Count by action
    actions_count = {}
    for entry in recent_history:
        action = entry["action"]
        actions_count[action] = actions_count.get(action, 0) + 1
    
    # Daily activity
    daily_activity = {}
    for entry in recent_history:
        date_str = entry["timestamp"].strftime("%Y-%m-%d")
        daily_activity[date_str] = daily_activity.get(date_str, 0) + 1
    
    return {
        "total_entries": len(_in_memory_history),
        "recent_entries": len(recent_history),
        "actions_count": actions_count,
        "daily_activity": [
            {"date": date, "count": count} 
            for date, count in daily_activity.items()
        ],
        "time_period_days": days
    }


@router.delete("/clear")
def clear_history(
    days_older_than: Optional[int] = Query(None, description="Clear history older than specified days"),
    all_history: bool = Query(False, description="Clear all history"),
):
    """
    Clear history entries
    """
    global _in_memory_history
    
    if all_history:
        cleared_count = len(_in_memory_history)
        _in_memory_history = []
        return {
            "message": f"Cleared all {cleared_count} history entries",
            "cleared_count": cleared_count
        }
    
    elif days_older_than:
        cutoff_date = datetime.utcnow() - timedelta(days=days_older_than)
        
        # Count entries to be cleared
        to_clear = [h for h in _in_memory_history if h["timestamp"] < cutoff_date]
        cleared_count = len(to_clear)
        
        # Remove old entries
        _in_memory_history = [
            h for h in _in_memory_history 
            if h["timestamp"] >= cutoff_date
        ]
        
        return {
            "message": f"Cleared {cleared_count} entries older than {days_older_than} days",
            "cleared_count": cleared_count,
            "remaining_count": len(_in_memory_history)
        }
    
    else:
        raise HTTPException(
            status_code=400,
            detail="Either specify 'days_older_than' or set 'all_history=true'"
        )


@router.get("/latest")
def get_latest_history(
    count: int = Query(10, description="Number of latest entries to retrieve")
):
    """
    Get the most recent history entries
    """
    latest = _in_memory_history[:min(count, len(_in_memory_history))]
    return {
        "latest_entries": latest,
        "total_count": len(_in_memory_history),
        "requested_count": count,
        "returned_count": len(latest)
    }


# Helper function to add packing history
def add_packing_history(
    container: Dict[str, Any],
    items: List[Dict[str, Any]],
    result: Dict[str, Any],
    user: str = "admin"
):
    """
    Helper to add packing calculation to history
    """
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.utcnow(),
        "action": "packing_calculation",
        "user": user,
        "details": {
            "container": container,
            "item_count": len(items),
            "items_sample": items[:3] if len(items) > 3 else items,
            "total_items": len(items)
        },
        "result": {
            "success": result.get("success", False),
            "bins_used": result.get("statistics", {}).get("bins_used", 0),
            "efficiency": result.get("statistics", {}).get("container_utilization", 0),
            "execution_time": result.get("execution_time", 0)
        }
    }
    
    _in_memory_history.insert(0, entry)
    
    # Keep only last 1000 entries
    if len(_in_memory_history) > 1000:
        _in_memory_history.pop()
    
    return entry