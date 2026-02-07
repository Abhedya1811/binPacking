from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
import uuid
from enum import Enum


# ===== ENUMS =====
class RotationMode(str, Enum):
    DISCRETE = "discrete"  # Only 90-degree rotations (compatible with py3dbp)
    ARBITRARY = "arbitrary"  # Any angle (enhanced algorithm)
    SMART = "smart"  # Smart sampling (default, best balance)
    NONE = "none"  # No rotation allowed


class RotationAxis(str, Enum):
    X = "x"
    Y = "y"
    Z = "z"
    ALL = "all"
    NONE = "none"


# ===== ROTATION CONSTRAINTS =====
class RotationConstraint(BaseModel):
    """Rotation constraints for an item"""
    
    model_config = ConfigDict(from_attributes=True)
    
    # Angle ranges (in degrees)
    min_angle_x: float = Field(0.0, ge=0, le=360, description="Minimum rotation around X axis")
    max_angle_x: float = Field(360.0, ge=0, le=360, description="Maximum rotation around X axis")
    min_angle_y: float = Field(0.0, ge=0, le=360, description="Minimum rotation around Y axis")
    max_angle_y: float = Field(360.0, ge=0, le=360, description="Maximum rotation around Y axis")
    min_angle_z: float = Field(0.0, ge=0, le=360, description="Minimum rotation around Z axis")
    max_angle_z: float = Field(360.0, ge=0, le=360, description="Maximum rotation around Z axis")
    
    # Rotation step/precision
    step_size: float = Field(15.0, ge=1.0, le=90.0, description="Rotation step size in degrees")
    
    # Specific allowed angles (overrides ranges)
    allowed_angles_x: Optional[List[float]] = Field(default=None, description="Specific allowed X rotation angles")
    allowed_angles_y: Optional[List[float]] = Field(default=None, description="Specific allowed Y rotation angles")
    allowed_angles_z: Optional[List[float]] = Field(default=None, description="Specific allowed Z rotation angles")
    
    # Enabled axes
    allowed_axes: List[RotationAxis] = Field(default=[RotationAxis.ALL], description="Axes allowed for rotation")
    
    @field_validator('min_angle_x', 'min_angle_y', 'min_angle_z', 
                     'max_angle_x', 'max_angle_y', 'max_angle_z')
    @classmethod
    def validate_angle_range(cls, v: float) -> float:
        """Ensure angles are within 0-360 range"""
        return max(0.0, min(360.0, v))
    
    @field_validator('allowed_angles_x', 'allowed_angles_y', 'allowed_angles_z')
    @classmethod
    def validate_allowed_angles(cls, v: Optional[List[float]]) -> Optional[List[float]]:
        """Normalize allowed angles to 0-360 range"""
        if v is None:
            return None
        return [angle % 360 for angle in v]
    
    @field_validator('step_size')
    @classmethod
    def validate_step_size(cls, v: float) -> float:
        """Ensure step size is reasonable"""
        return max(1.0, min(90.0, v))


# ===== ITEM SCHEMA (UPDATED) =====
class ItemSchema(BaseModel):
    """Item schema for packing with enhanced rotation support"""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: str = Field(..., description="Unique identifier for the item")
    name: Optional[str] = Field(None, description="Display name for the item")  
    width: float = Field(..., gt=0, description="Width in meters")
    height: float = Field(..., gt=0, description="Height in meters")
    depth: float = Field(..., gt=0, description="Depth in meters")
    weight: Optional[float] = Field(0.0, ge=0, description="Weight in kg")  
    quantity: int = Field(1, ge=1, description="Number of identical items")
    
    # Enhanced rotation settings (backward compatible)
    can_rotate: bool = Field(True, description="Whether item can be rotated")
    rotation_mode: RotationMode = Field(RotationMode.SMART, description="Rotation mode to use")
    rotation_constraint: Optional[RotationConstraint] = Field(
        None, 
        description="Detailed rotation constraints"
    )
    
    color: Optional[str] = Field(None, description="Color for 3D visualization")  
    
    @field_validator('color')
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v and not v.startswith('#'):
            # Try to fix or generate color
            if v.lower() in ['red', 'green', 'blue', 'yellow', 'orange', 'purple']:
                color_map = {
                    'red': '#FF0000',
                    'green': '#00FF00', 
                    'blue': '#0000FF',
                    'yellow': '#FFFF00',
                    'orange': '#FFA500',
                    'purple': '#800080'
                }
                return color_map[v.lower()]
            else:
                return '#3B82F6'  # Default blue color
        return v
    
    @field_validator('width', 'height', 'depth')
    @classmethod
    def validate_dimensions(cls, v: float) -> float:
        """Ensure dimensions are in reasonable range"""
        if v > 100:  # 100 meters maximum
            raise ValueError('Dimension too large (max 100m)')
        return v
    
    @field_validator('rotation_constraint')
    @classmethod
    def set_default_constraint(cls, v: Optional[RotationConstraint], info) -> RotationConstraint:
        """Set default rotation constraint if none provided"""
        if v is None:
            # Create default constraint based on can_rotate
            data = info.data
            can_rotate = data.get('can_rotate', True)
            
            if not can_rotate:
                return RotationConstraint(
                    min_angle_x=0, max_angle_x=0,
                    min_angle_y=0, max_angle_y=0,
                    min_angle_z=0, max_angle_z=0,
                    step_size=90,
                    allowed_axes=[RotationAxis.NONE],
                    allowed_angles_x=None,
                    allowed_angles_y=None,
                    allowed_angles_z=None
                )
            return RotationConstraint(
                    min_angle_x=0.0, max_angle_x=360.0,
                    min_angle_y=0.0, max_angle_y=360.0,
                    min_angle_z=0.0, max_angle_z=360.0,
                    step_size=15.0,
                    allowed_angles_x=None,
                    allowed_angles_y=None,
                    allowed_angles_z=None,
                    allowed_axes=[RotationAxis.ALL]
                )
        return v
    
    @field_validator('rotation_mode')
    @classmethod
    def validate_rotation_mode(cls, v: RotationMode, info) -> RotationMode:
        """Validate rotation mode based on can_rotate"""
        data = info.data
        can_rotate = data.get('can_rotate', True)
        
        if not can_rotate and v != RotationMode.NONE:
            return RotationMode.NONE
        
        return v


# ===== BIN CONFIG =====
class BinConfig(BaseModel):
    """Container configuration"""
    
    model_config = ConfigDict(from_attributes=True)
    
    width: float = Field(..., gt=0, description="Bin width in meters")
    height: float = Field(..., gt=0, description="Bin height in meters")
    depth: float = Field(..., gt=0, description="Bin depth in meters")
    max_weight: Optional[float] = Field(10000.0, ge=0, description="Max weight capacity in kg")
    name: Optional[str] = Field("Container", description="Name for the bin")
    
    @field_validator('width', 'height', 'depth')
    @classmethod
    def validate_container_dimensions(cls, v: float) -> float:
        """Ensure container dimensions are reasonable"""
        if v > 50:  # 50 meters maximum for container
            raise ValueError('Container dimension too large (max 50m)')
        return v


# ===== PACKED ITEM =====
class PackedItem(BaseModel):
    """Packed item result with enhanced rotation information"""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: str = Field(..., description="Item identifier")
    position: List[Union[int, float]] = Field(..., description="Position [x, y, z] in meters")
    rotation: List[Union[int, float]] = Field(..., description="Rotation angles [x, y, z] in degrees")
    dimensions: List[Union[int, float]] = Field(..., description="Dimensions [width, height, depth] in meters")
    color: Optional[str] = Field(None, description="Color for visualization")
    original_name: Optional[str] = Field(None, description="Original item name")
    
    # New fields for rotation info
    original_dimensions: Optional[List[Union[int, float]]] = Field(
        None, 
        description="Original dimensions before rotation"
    )
    rotation_mode_used: Optional[str] = Field(
        None, 
        description="Rotation mode used for this item"
    )
    bounding_box_volume: Optional[float] = Field(
        None, 
        description="Volume of bounding box after rotation"
    )
    
    @field_validator('position', 'rotation', 'dimensions', 'original_dimensions')
    @classmethod
    def validate_list_length(cls, v: Optional[List[Union[int, float]]]) -> Optional[List[Union[int, float]]]:
        """Ensure all lists have exactly 3 elements"""
        if v is None:
            return None
        if len(v) != 3:
            raise ValueError('Must have exactly 3 elements')
        return v
    
    @field_validator('position', 'rotation', 'dimensions', 'original_dimensions', mode='before')
    @classmethod
    def convert_to_float(cls, v: Any) -> Optional[List[float]]:
        """Convert all numeric values to float for consistency"""
        if v is None:
            return None
        if isinstance(v, (list, tuple)):
            return [float(x) for x in v]
        elif isinstance(v, dict):
            # Handle dictionary input if needed
            return [float(v.get('x', 0)), float(v.get('y', 0)), float(v.get('z', 0))]
        else:
            raise ValueError('Must be a list, tuple, or dict with x,y,z keys')
    
    @field_validator('rotation')
    @classmethod
    def normalize_rotation_angles(cls, v: List[float]) -> List[float]:
        """Normalize rotation angles to 0-360 range"""
        return [angle % 360 for angle in v]
    
    @field_validator('bounding_box_volume')
    @classmethod
    def calculate_bounding_box_volume(cls, v: Optional[float], info) -> Optional[float]:
        """Calculate bounding box volume if not provided"""
        if v is None:
            data = info.data
            if 'dimensions' in data and data['dimensions']:
                dims = data['dimensions']
                if len(dims) == 3:
                    return dims[0] * dims[1] * dims[2]
        return v


# ===== PACKED BIN (DEFINED BEFORE PackingResult) =====
class PackedBin(BaseModel):
    """Packed bin result"""
    
    model_config = ConfigDict(from_attributes=True)
    bin_id: str = Field(..., description="Bin identifier")
    dimensions: List[Union[int, float]] = Field(..., description="Bin dimensions [width, height, depth] in meters")
    items: List[PackedItem] = Field(..., description="Items packed in this bin")
    utilization: float = Field(..., ge=0, le=100, description="Space utilization percentage")
    weight_utilization: Optional[float] = Field(None, ge=0, le=100, description="Weight utilization percentage")
    
    @field_validator('dimensions')
    @classmethod
    def validate_dimensions_length(cls, v: List[Union[int, float]]) -> List[Union[int, float]]:
        if len(v) != 3:
            raise ValueError('Dimensions must have exactly 3 elements')
        return v


# ===== UNPACKED ITEM =====
class UnpackedItem(BaseModel):
    """Schema for items that couldn't be packed"""
    
    model_config = ConfigDict(from_attributes=True)
    
    name: str = Field(..., description="Item name")
    id: str = Field(..., description="Item identifier")
    dimensions: List[float] = Field(..., description="Dimensions [width, height, depth] in meters")
    volume: float = Field(..., ge=0, description="Item volume in cubic meters")
    color: str = Field(..., description="Color for visualization")
    reason: str = Field(..., description="Reason why item couldn't be packed")
    weight: float = Field(0.0, ge=0, description="Item weight in kg")
    quantity: int = Field(1, ge=1, description="Number of unpacked items of this type")
    
    # New field for rotation attempts
    rotation_attempts: Optional[int] = Field(
        None, 
        description="Number of rotation attempts made"
    )


# ===== PACKING REQUEST =====
class PackingRequest(BaseModel):
    """Packing request from frontend with rotation options"""
    
    model_config = ConfigDict(
        from_attributes=True,
        extra="allow"  # Allow extra fields for future compatibility
    )
    
    bin_config: BinConfig
    items: List[ItemSchema]
    algorithm: str = Field("maximal-rectangles", description="Packing algorithm to use")
    allow_multiple_bins: bool = Field(False, description="Allow using multiple bins if needed")
    maximize_efficiency: bool = Field(True, description="Try to maximize packing efficiency")
    
    # Enhanced rotation settings
    rotation_precision: float = Field(15.0, ge=1.0, le=90.0, description="Default rotation step in degrees")
    optimize_for_rotation: bool = Field(True, description="Optimize packing considering rotations")
    max_rotation_attempts: int = Field(50, ge=1, le=500, description="Maximum rotation attempts per item")
    
    @field_validator('items')
    @classmethod
    def validate_items(cls, v: List[ItemSchema]) -> List[ItemSchema]:
        if not v:
            raise ValueError('At least one item is required')
        
        # Check for duplicate IDs
        ids = [item.id for item in v]
        if len(ids) != len(set(ids)):
            raise ValueError('Item IDs must be unique')
        
        return v
    
    @field_validator('algorithm')
    @classmethod
    def validate_algorithm(cls, v: str) -> str:
        """Validate and normalize algorithm name"""
        valid_algorithms = [
            "maximal-rectangles", "maxrects", "guillotine", 
            "skyline", "genetic", "firstfit", "bestfit",
            "arbitrary-rotation"  # New algorithm for arbitrary rotations
        ]
        
        if v.lower() not in valid_algorithms:
            raise ValueError(f'Invalid algorithm. Must be one of: {", ".join(valid_algorithms)}')
        
        return v.lower()
    
    @field_validator('rotation_precision')
    @classmethod
    def validate_rotation_precision(cls, v: float) -> float:
        """Ensure rotation precision is reasonable"""
        return max(1.0, min(90.0, v))


# ===== PACKING RESULT =====
class PackingResult(BaseModel):
    """Complete packing result with rotation statistics"""
    
    model_config = ConfigDict(from_attributes=True)
    
    bins: List[PackedBin] = Field(..., description="Packed bins")
    statistics: Dict[str, Any] = Field(..., description="Packing statistics")
    job_id: Optional[uuid.UUID] = Field(None, description="Job identifier for async processing")
    visualization_data: Optional[Dict[str, Any]] = Field(None, description="Data for 3D visualization")
    unpacked_items: Optional[List[UnpackedItem]] = Field(None, description="Items that couldn't be packed")
    
    @field_validator('statistics')
    @classmethod
    def validate_statistics(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure required statistics are present and add rotation stats"""
        required_stats = ['success', 'space_utilization', 'packing_efficiency']
        
        if not isinstance(v, dict):
            raise ValueError('Statistics must be a dictionary')
        
        if 'success' not in v:
            v['success'] = False
        
        # Ensure rotation stats are included
        if 'rotation_stats' not in v:
            v['rotation_stats'] = {
                'items_with_rotation': 0,
                'max_rotation_angle': 0,
                'avg_rotation_angle': 0,
                'rotation_modes_used': {}
            }
        
        return v


# ===== PACKING STATISTICS =====
class PackingStatistics(BaseModel):
    """Detailed packing statistics with rotation information"""
    
    model_config = ConfigDict(from_attributes=True)
    
    # Basic stats (unchanged)
    success: bool = Field(..., description="Whether packing was successful")
    space_utilization: float = Field(..., ge=0, le=100, description="Space utilization percentage")
    packing_efficiency: float = Field(..., ge=0, le=100, description="Packing efficiency percentage")
    container_volume: float = Field(..., ge=0, description="Container volume in m³")
    total_item_volume: float = Field(..., ge=0, description="Total item volume in m³")
    packed_volume: float = Field(..., ge=0, description="Packed volume in m³")
    empty_volume: float = Field(..., ge=0, description="Empty space volume in m³")
    total_item_weight: float = Field(..., ge=0, description="Total item weight in kg")
    packed_weight: float = Field(..., ge=0, description="Packed weight in kg")
    bins_used: int = Field(..., ge=0, description="Number of bins used")
    items_packed: int = Field(..., ge=0, description="Number of items packed")
    total_items: int = Field(..., ge=0, description="Total number of items")
    unpacked_items_count: Optional[int] = Field(0, ge=0, description="Number of items not packed")
    execution_time_ms: float = Field(..., ge=0, description="Execution time in milliseconds")
    algorithm: str = Field(..., description="Algorithm used")
    validation_warnings: Optional[List[str]] = Field(None, description="Validation warnings")
    strategy_used: Optional[str] = Field(None, description="Strategy used for packing")
    
    # New rotation statistics
    rotation_stats: Dict[str, Any] = Field(
        default_factory=lambda: {
            'items_with_rotation': 0,
            'max_rotation_angle': 0,
            'avg_rotation_angle': 0,
            'min_rotation_angle': 0,
            'rotation_modes_used': {},
            'rotation_efficiency_gain': 0.0,
            'rotation_attempts': 0
        },
        description="Statistics about item rotations"
    )
    
    solution_valid: bool = Field(True, description="Whether solution passed validation")
    rotation_mode: Optional[str] = Field(None, description="Overall rotation mode used")


# ===== VISUALIZATION DATA =====
class VisualizationData(BaseModel):
    """Data for 3D visualization"""
    
    model_config = ConfigDict(from_attributes=True)
    
    items: List[Dict[str, Any]] = Field(..., description="Packed items for visualization")
    unpacked_items: Optional[List[Dict[str, Any]]] = Field(None, description="Unpacked items for visualization")
    container: Dict[str, Any] = Field(..., description="Container data")
    scene: Dict[str, Any] = Field(..., description="Scene configuration")
    summary: Optional[Dict[str, Any]] = Field(None, description="Visualization summary")


# ===== JOB SCHEMAS =====
class PackingJobBase(BaseModel):
    """Base packing job schema"""
    
    model_config = ConfigDict(from_attributes=True)
    
    name: str = Field(..., min_length=1, max_length=200, description="Job name")
    description: Optional[str] = Field(None, description="Job description")
    tags: Optional[List[str]] = Field(None, description="Tags for categorization")


class PackingJobCreate(PackingJobBase):
    """Create packing job schema with rotation options"""
    
    model_config = ConfigDict(from_attributes=True)
    
    name: str = Field(..., min_length=1, max_length=200, description="Job name")
    description: Optional[str] = Field(None, description="Job description")
    tags: Optional[List[str]] = Field(None, description="Tags for categorization")
    
    bin_config: BinConfig
    items: List[ItemSchema]
    algorithm: str = Field("maximal-rectangles", description="Packing algorithm")
    
    # New rotation settings
    rotation_precision: float = Field(15.0, ge=1.0, le=90.0, description="Rotation step in degrees")
    optimize_for_rotation: bool = Field(True, description="Optimize for rotations")
    
    priority: Optional[int] = Field(1, ge=1, le=10, description="Job priority (1-10)")


class PackingJobResponse(PackingJobBase):
    """Packing job response schema with rotation info"""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID = Field(..., description="Job ID")
    user_id: Optional[uuid.UUID] = Field(None, description="User ID")
    bin_width: float = Field(..., description="Container width")
    bin_height: float = Field(..., description="Container height")
    bin_depth: float = Field(..., description="Container depth")
    bin_weight_limit: Optional[float] = Field(None, description="Weight limit")
    items_data: List[Dict[str, Any]] = Field(..., description="Items data")
    packing_result: Optional[Dict[str, Any]] = Field(None, description="Packing result")
    efficiency: Optional[float] = Field(None, ge=0, le=100, description="Packing efficiency")
    bins_used: int = Field(0, ge=0, description="Number of bins used")
    status: str = Field(..., description="Job status")
    created_at: datetime = Field(..., description="Creation timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    algorithm_used: Optional[str] = Field(None, description="Algorithm used")
    execution_time_ms: Optional[float] = Field(None, description="Execution time")
    unpacked_items_count: Optional[int] = Field(0, description="Number of unpacked items")
    
    # New fields
    rotation_mode_used: Optional[str] = Field(None, description="Rotation mode used")
    items_with_rotation: Optional[int] = Field(0, description="Number of items with rotation")
    rotation_efficiency_gain: Optional[float] = Field(
        0.0, 
        description="Efficiency gain from rotation optimization"
    )


class PackingJobUpdate(BaseModel):
    """Update packing job schema"""
    
    model_config = ConfigDict(from_attributes=True)
    
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="Job name")
    description: Optional[str] = Field(None, description="Job description")
    tags: Optional[List[str]] = Field(None, description="Tags")
    status: Optional[str] = Field(None, description="Status update")


class PackingJobStatus(BaseModel):
    """Packing job status response"""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID = Field(..., description="Job ID")
    status: str = Field(..., description="Current status")
    progress: Optional[float] = Field(None, ge=0, le=100, description="Progress percentage")
    estimated_completion: Optional[datetime] = Field(None, description="Estimated completion time")
    message: Optional[str] = Field(None, description="Status message")


class ErrorResponse(BaseModel):
    """Error response schema"""
    
    model_config = ConfigDict(from_attributes=True)
    
    error: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Error details")
    code: Optional[str] = Field(None, description="Error code")
    timestamp: datetime = Field(default_factory=datetime.now, description="Error timestamp")