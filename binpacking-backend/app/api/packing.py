"""
Packing API endpoints - Fixed Version
"""

from fastapi import APIRouter, HTTPException, status
from typing import List

from app.schemas.packing import PackingRequest, PackingResult
from app.services.packing_service import packing_service 

router = APIRouter()


@router.post("/calculate", response_model=PackingResult)
async def calculate_packing(request: PackingRequest):
   
    breakpoint()
    try:
        result = packing_service.calculate_packing(request)
        
        if not result.statistics.get("success", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.statistics.get("error", "Packing calculation failed")
            )
        print("Packing calculation successful:", result)
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Packing calculation error: {str(e)}"
        )


@router.post("/validate")
async def validate_packing(request: PackingRequest):
    """
    Validate packing request without calculating
    
    Args:
        request: PackingRequest to validate
        
    Returns:
        Validation results
    """
    try:
        validation = packing_service._validate_request(request)
        
        return {
            "valid": validation["valid"],
            "errors": validation["errors"],
            "warnings": validation["warnings"],
            "volume_analysis": {
                "total_item_volume": validation["total_volume"],
                "container_volume": validation["container_volume"],
                "volume_ratio": round(validation["total_volume"] / validation["container_volume"], 2) 
                if validation["container_volume"] > 0 else 0
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation error: {str(e)}"
        )


# @router.post("/quick-test", response_model=PackingResult)
# async def quick_test():
#     """
#     Quick test endpoint to verify packing service works
#     """
#     try:
#         return packing_service.quick_test()
#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Test failed: {str(e)}"
#         )


@router.get("/algorithms")
async def get_algorithms():
    """
    Get available packing algorithms
    """
    return {
        "algorithms": [
            {"id": "maxrects", "name": "Maximal Rectangles", "description": "Default algorithm for optimal packing"},
            {"id": "firstfit", "name": "First Fit", "description": "Simple algorithm for quick packing"},
            {"id": "bestfit", "name": "Best Fit", "description": "Algorithm for best space utilization"},
            {"id": "guillotine", "name": "Guillotine", "description": "Algorithm for rectangular cuts"}
        ],
        "default_algorithm": "maxrects"
    }


# @router.get("/health")
# async def health_check():
#     """
#     Packing service health check
#     """
#     try:
#         # Quick test to verify service works
#         test_result = packing_service.quick_test()
        
#         return {
#             "status": "healthy",
#             "service": "packing",
#             "version": "1.0.0",
#             "test_passed": test_result.statistics.get("success", False),
#             "bins_packed": len(test_result.bins),
#             "message": "3D Bin Packing service is operational"
#         }
#     except Exception as e:
#         return {
#             "status": "unhealthy",
#             "service": "packing",
#             "error": str(e),
#             "message": "3D Bin Packing service failed"
#         }