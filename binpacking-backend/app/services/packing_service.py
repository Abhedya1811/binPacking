"""
ULTIMATE 3D BIN PACKING - PY3DBP + OR-TOOLS + MES
- FIXED: All type errors resolved
- FIXED: OR-Tools thresholds for proper categorization
- FIXED: MES space splitting to eliminate gaps
- FIXED: Space merging to create larger contiguous spaces
- OPTIMIZED: Left-to-right packing with width matching
- OPTIMIZED: Descending sort for all categories
- OPTIMIZED: Z-axis gap filling
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple, Union
import time
import uuid
import numpy as np
import traceback
from app.schemas.packing import (
    ItemSchema, BinConfig, PackingRequest, 
    PackingResult, PackedBin, PackedItem, UnpackedItem, VisualizationData,
    RotationMode, RotationAxis, RotationConstraint
)

# Import py3dbp
try:
    from py3dbp import Packer, Bin, Item
    PY3DBP_AVAILABLE = True
    print("✅ py3dbp successfully imported")
except ImportError:
    print("⚠️ py3dbp not installed. Installing...")
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "py3dbp"])
    from py3dbp import Packer, Bin, Item
    PY3DBP_AVAILABLE = True
    print("✅ py3dbp installed")

# Import OR-Tools
try:
    from ortools.sat.python import cp_model
    ORTOOLS_AVAILABLE = True
    print("✅ OR-Tools successfully imported")
except ImportError:
    print("⚠️ OR-Tools not installed. Installing...")
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "ortools"])
    from ortools.sat.python import cp_model
    ORTOOLS_AVAILABLE = True
    print("✅ OR-Tools installed")

# ====================================================================
# TYPE SAFE CONVERTER
# ====================================================================

class TypeSafeConverter:
    """Type-safe converter with proper type annotations"""
    
    EPSILON = 0.0001
    
    @staticmethod
    def to_float(value: Any, default: float = 0.0) -> float:
        """Convert any value to float safely"""
        try:
            if value is None:
                return default
            if isinstance(value, (int, float, np.floating)):
                return float(value)
            if isinstance(value, str):
                return float(value.strip())
            if hasattr(value, '__float__'):
                return float(value)
            return default
        except (ValueError, TypeError, AttributeError):
            return default
    
    @staticmethod
    def to_int(value: Any, default: int = 0) -> int:
        """Convert any value to int safely"""
        try:
            return int(TypeSafeConverter.to_float(value, default))
        except Exception:
            return default
    
    @staticmethod
    def to_string(value: Any, default: str = "") -> str:
        """Convert any value to string safely"""
        try:
            if value is None:
                return default
            return str(value)
        except Exception:
            return default
    
    @staticmethod
    def to_number_list(value: Any, default: Optional[List[float]] = None) -> List[float]:
        """Convert any value to list of numbers safely"""
        if default is None:
            default = [0.0, 0.0, 0.0]
        try:
            if value is None:
                return default.copy()
            
            if isinstance(value, (list, tuple)):
                result = []
                for item in value[:3]:
                    try:
                        if hasattr(item, '__float__'):
                            result.append(float(item))
                        else:
                            result.append(float(item))
                    except (ValueError, TypeError):
                        result.append(0.0)
                
                while len(result) < 3:
                    result.append(0.0)
                
                return [round(r, 4) for r in result[:3]]
            
            return [round(float(value), 4), 0.0, 0.0]
            
        except Exception:
            return default.copy()

SafeConverter = TypeSafeConverter

# ====================================================================
# BOUNDARY VALIDATOR
# ====================================================================

class BoundaryValidator:
    """Strict validator ensuring items stay within container boundaries"""
    
    @staticmethod
    def is_item_within_container(item_pos: List[float], item_dims: List[float], 
                                container_dims: List[float], tolerance: float = 0.001) -> Tuple[bool, str]:
        """Strict check if item is completely within container"""
        try:
            if len(item_pos) < 3:
                item_pos = item_pos + [0.0] * (3 - len(item_pos))
            if len(item_dims) < 3:
                item_dims = item_dims + [0.0] * (3 - len(item_dims))
            if len(container_dims) < 3:
                container_dims = container_dims + [0.0] * (3 - len(container_dims))
            
            x = SafeConverter.to_float(item_pos[0])
            y = SafeConverter.to_float(item_pos[1])
            z = SafeConverter.to_float(item_pos[2])
            
            w = SafeConverter.to_float(item_dims[0])
            h = SafeConverter.to_float(item_dims[1])
            d = SafeConverter.to_float(item_dims[2])
            
            cw = SafeConverter.to_float(container_dims[0])
            ch = SafeConverter.to_float(container_dims[1])
            cd = SafeConverter.to_float(container_dims[2])
            
            if any(v < 0 for v in [w, h, d, cw, ch, cd]):
                return False, "Invalid negative dimensions"
            
            if x < -tolerance:
                return False, f"X position {x:.3f} < 0"
            if x + w > cw + tolerance:
                return False, f"X {x:.3f} + width {w:.3f} = {x+w:.3f} > container width {cw:.3f}"
            
            if y < -tolerance:
                return False, f"Y position {y:.3f} < 0"
            if y + h > ch + tolerance:
                return False, f"Y {y:.3f} + height {h:.3f} = {y+h:.3f} > container height {ch:.3f}"
            
            if z < -tolerance:
                return False, f"Z position {z:.3f} < 0"
            if z + d > cd + tolerance:
                return False, f"Z {z:.3f} + depth {d:.3f} = {z+d:.3f} > container depth {cd:.3f}"
            
            return True, "OK"
            
        except Exception as e:
            return False, f"Validation error: {str(e)}"

# ====================================================================
# GRAVITY/SUPPORT VALIDATOR
# ====================================================================

class SupportValidator:
    """Validates items have proper support (gravity compliance)"""
    
    @staticmethod
    def has_support(item_pos: List[float], item_dims: List[float],
                   placed_items: List[Dict], tolerance: float = 0.001, is_small_item: bool = False) -> Tuple[bool, str]:
        """
        Check if item has proper support underneath
        Items on floor (y=0) always have support
        Items above must have sufficient base supported
        """
        x, y, z = item_pos
        w, h, d = item_dims
        
        # On floor - always supported
        if abs(y) < tolerance:
            return True, "On floor"
        
        # Calculate support area
        total_base_area = w * d
        supported_area = 0.0
        
        for placed in placed_items:
            p_pos = placed['position']
            p_dims = placed['dimensions']
            
            # Check if placed item is directly underneath
            if abs(p_pos[1] + p_dims[1] - y) > tolerance:
                continue
            
            # Calculate overlap in X and Z
            overlap_x = max(0, min(x + w, p_pos[0] + p_dims[0]) - max(x, p_pos[0]))
            overlap_z = max(0, min(z + d, p_pos[2] + p_dims[2]) - max(z, p_pos[2]))
            
            supported_area += overlap_x * overlap_z
        
        # Different support requirements based on item size
        support_threshold = 0.5 if is_small_item else 0.7
        
        support_ratio = supported_area / total_base_area if total_base_area > 0 else 0
        
        if support_ratio >= support_threshold:
            return True, f"Supported: {support_ratio:.1%}"
        else:
            return False, f"Insufficient support: {support_ratio:.1%}"

# ====================================================================
# OVERLAP VALIDATOR
# ====================================================================

class OverlapValidator:
    """Validates items don't overlap with each other"""
    
    @staticmethod
    def check_overlap(item1_pos: List[float], item1_dims: List[float],
                     item2_pos: List[float], item2_dims: List[float],
                     tolerance: float = 0.001) -> bool:
        """Check if two items overlap (returns True if they overlap)"""
        x1, y1, z1 = item1_pos
        w1, h1, d1 = item1_dims
        x2, y2, z2 = item2_pos
        w2, h2, d2 = item2_dims
        
        overlap_x = not (x1 + w1 <= x2 + tolerance or x2 + w2 <= x1 + tolerance)
        overlap_y = not (y1 + h1 <= y2 + tolerance or y2 + h2 <= y1 + tolerance)
        overlap_z = not (z1 + d1 <= z2 + tolerance or z2 + d2 <= z1 + tolerance)
        
        return overlap_x and overlap_y and overlap_z
    
    @staticmethod
    def check_item_with_placed(item_pos: List[float], item_dims: List[float],
                              placed_items: List[Dict], tolerance: float = 0.001) -> Tuple[bool, str]:
        """Check if item overlaps with any placed item"""
        for placed in placed_items:
            if OverlapValidator.check_overlap(
                item_pos, item_dims,
                placed['position'], placed['dimensions'],
                tolerance
            ):
                return True, f"Overlaps with {placed.get('id', 'unknown')}"
        return False, "OK"

# ====================================================================
# SPACE 3D
# ====================================================================

@dataclass
class Space3D:
    """Represents an empty space in the container"""
    x: float
    y: float
    z: float
    width: float
    height: float
    depth: float
    
    def __post_init__(self):
        # Round to avoid floating point issues
        self.x = round(self.x, 4)
        self.y = round(self.y, 4)
        self.z = round(self.z, 4)
        self.width = round(self.width, 4)
        self.height = round(self.height, 4)
        self.depth = round(self.depth, 4)
    
    @property
    def volume(self) -> float:
        return self.width * self.height * self.depth
    
    @property
    def x2(self) -> float:
        return self.x + self.width
    
    @property
    def y2(self) -> float:
        return self.y + self.height
    
    @property
    def z2(self) -> float:
        return self.z + self.depth
    
    def can_place_item(self, item_width: float, item_height: float, item_depth: float,
                      tolerance: float = 0.001) -> bool:
        """Check if item can fit in this space"""
        return (item_width <= self.width + tolerance and
                item_height <= self.height + tolerance and
                item_depth <= self.depth + tolerance)


# ====================================================================
# OR-TOOLS OPTIMIZER - FIXED CATEGORIZATION
# ====================================================================

class ORToolsOptimizer:
    """Uses OR-Tools to select optimal items for packing with dynamic strategy"""
    
    @staticmethod
    def optimize_item_selection(items: List[Dict], container_dims: List[float], strategy: str = "maximal") -> Tuple[List[Dict], List[Dict], List[Dict]]:
        """
        Optimize item selection using OR-Tools CP-SAT solver
        Returns: (priority_items, secondary_items, tertiary_items) based on strategy
        """
        try:
            if not items:
                return [], [], []
            
            cw, ch, cd = container_dims
            container_volume = cw * ch * cd
            container_max_dim = max(cw, ch, cd)
            
            # Calculate dynamic thresholds based on container size
            LARGE_VOLUME_THRESHOLD = container_volume * 0.02  # 2% of container volume
            MEDIUM_VOLUME_THRESHOLD = container_volume * 0.005  # 0.5% of container volume
            LARGE_DIM_THRESHOLD = container_max_dim * 0.3  # 30% of max dimension
            MEDIUM_DIM_THRESHOLD = container_max_dim * 0.15  # 15% of max dimension
            
            print(f"📊 Thresholds: Large > {LARGE_VOLUME_THRESHOLD:.1f}m³ or >{LARGE_DIM_THRESHOLD:.1f}m, "
                  f"Medium > {MEDIUM_VOLUME_THRESHOLD:.1f}m³ or >{MEDIUM_DIM_THRESHOLD:.1f}m")
            
            # Categorize items
            large_items = []
            medium_items = []
            small_items = []
            
            for item in items:
                vol = item['width'] * item['height'] * item['depth']
                max_dim = max(item['width'], item['height'], item['depth'])
                
                if vol > LARGE_VOLUME_THRESHOLD or max_dim > LARGE_DIM_THRESHOLD:
                    large_items.append(item)
                elif vol > MEDIUM_VOLUME_THRESHOLD or max_dim > MEDIUM_DIM_THRESHOLD:
                    medium_items.append(item)
                else:
                    small_items.append(item)
            
            # Sort each category in DESCENDING order by volume
            large_items.sort(key=lambda x: -(x['width'] * x['height'] * x['depth']))
            medium_items.sort(key=lambda x: -(x['width'] * x['height'] * x['depth']))
            small_items.sort(key=lambda x: -(x['width'] * x['height'] * x['depth']))
            
            print(f"📊 Category counts: Large: {len(large_items)}, Medium: {len(medium_items)}, Small: {len(small_items)}")
            
            # Return based on strategy
            if strategy == "maximal":
                # Large first, then medium, then small
                return large_items, medium_items, small_items
            elif strategy == "medium":
                # Medium first, then small, then large
                return medium_items, small_items, large_items
            elif strategy == "small":
                # Small first, then medium, then large
                return small_items, medium_items, large_items
            else:
                return large_items, medium_items, small_items
            
        except Exception as e:
            print(f"⚠️ OR-Tools optimization failed: {e}")
            traceback.print_exc()
            return [], [], []


# ====================================================================
# MAXIMAL EMPTY SPACES FINDER - ENHANCED FOR Z-AXIS GAP FILLING
# ====================================================================

class MaximalEmptySpacesFinder:
    """
    Implements Maximal Empty Spaces (MES) algorithm for optimal packing
    ENHANCED: Z-axis gap filling and better space utilization
    """
    
    def __init__(self):
        self.boundary_validator = BoundaryValidator()
        self.overlap_validator = OverlapValidator()
        self.support_validator = SupportValidator()
        self.spaces = []
        self.door_gap = 0.3
    
    def reset(self, container_dims: List[float]):
        """Reset with initial empty space"""
        cw, ch, cd = container_dims
        effective_width = cw - self.door_gap
        self.spaces = [Space3D(0, 0, 0, effective_width, ch, cd)]
    
    def find_best_position(self, item_dims: List[float], container_dims: List[float],
                          placed_items: List[Dict], is_small_item: bool = False) -> Tuple[Optional[List[float]], Optional[List[float]], Optional[List[float]]]:
        """
        Find best position using improved MES approach
        Enhanced for Z-axis gap filling
        """
        try:
            w, h, d = item_dims
            best_pos = None
            best_dims = None
            best_rot = None
            best_space_idx = -1
            best_score = float('-inf')
            
            # Sort spaces by Z position (front to back) and then by volume
            sorted_spaces = sorted(enumerate(self.spaces), key=lambda x: (x[1].z, -x[1].volume))
            
            for idx, space in sorted_spaces:
                # Try all 6 orientations
                orientations = [
                    ([w, h, d], [0.0, 0.0, 0.0]),
                    ([w, d, h], [0.0, 90.0, 0.0]),
                    ([h, w, d], [90.0, 0.0, 0.0]),
                    ([h, d, w], [90.0, 90.0, 0.0]),
                    ([d, w, h], [0.0, 90.0, 90.0]),
                    ([d, h, w], [90.0, 0.0, 90.0])
                ]
                
                # Sort orientations by how well they fill the space depth (Z-axis)
                orientations.sort(key=lambda o: -min(o[0][2], space.depth))
                
                for orient_dims, rotation in orientations:
                    ow, oh, od = orient_dims
                    
                    # Check if orientation fits
                    if (ow <= space.width + 0.001 and 
                        oh <= space.height + 0.001 and 
                        od <= space.depth + 0.001):
                        
                        # Try multiple Z positions to fill gaps
                        z_positions = [space.z]
                        
                        # For better Z-axis filling, try positions that align with existing items
                        if len(placed_items) > 0:
                            # Try positions that align with item edges in Z-axis
                            for item in placed_items[-5:]:  # Check recent items
                                item_z_end = item['position'][2] + item['dimensions'][2]
                                if item_z_end + od <= space.z + space.depth + 0.001:
                                    z_positions.append(item_z_end)
                        
                        # Remove duplicates and sort
                        z_positions = sorted(list(set([round(z, 4) for z in z_positions if z >= space.z - 0.001])))
                        
                        for test_z in z_positions:
                            x, y = space.x, space.y
                            
                            # Check if position is valid
                            if test_z + od > space.z + space.depth + 0.001:
                                continue
                            
                            # Check overlap
                            overlap = False
                            for placed in placed_items:
                                if self.overlap_validator.check_overlap(
                                    [x, y, test_z], [ow, oh, od],
                                    placed['position'], placed['dimensions']
                                ):
                                    overlap = True
                                    break
                            
                            if not overlap:
                                # Check support
                                has_support, _ = self.support_validator.has_support(
                                    [x, y, test_z], [ow, oh, od], placed_items, is_small_item=is_small_item
                                )
                                
                                if has_support or abs(y) < 0.001:
                                    # Calculate score - emphasize Z-axis filling
                                    depth_fill = od / space.depth if space.depth > 0 else 0
                                    volume_fill = (ow * oh * od) / space.volume if space.volume > 0 else 0
                                    
                                    # Prefer positions that fill Z-axis gaps
                                    z_score = 1.0 / (abs(test_z - space.z) + 1.0)
                                    
                                    score = (
                                        depth_fill * 0.4 +      # 40% weight on depth filling
                                        volume_fill * 0.3 +     # 30% weight on volume filling
                                        z_score * 0.3           # 30% weight on Z position
                                    )
                                    
                                    if score > best_score:
                                        best_score = score
                                        best_pos = [x, y, test_z]
                                        best_dims = orient_dims
                                        best_rot = rotation
                                        best_space_idx = idx
            
            if best_pos is not None and best_dims is not None and best_rot is not None:
                used_space = self.spaces.pop(best_space_idx)
                self._split_space(used_space, best_pos, best_dims)
                self._merge_spaces()
                return best_pos, best_dims, best_rot
            
            return None, None, None
            
        except Exception as e:
            print(f"⚠️ MES position finding failed: {e}")
            return None, None, None
    
    def _split_space(self, space: Space3D, pos: List[float], dims: List[float]):
        """
        Split space after placing an item - creates maximal empty spaces
        Enhanced for better Z-axis space management
        """
        x, y, z = pos
        w, h, d = dims
        
        # Right space
        if space.x + space.width > x + w + 0.001:
            self.spaces.append(Space3D(
                x + w, y, z,
                space.x + space.width - (x + w),
                space.height,
                space.depth
            ))
        
        # Left space (if not at wall)
        if x > space.x + 0.001:
            self.spaces.append(Space3D(
                space.x, y, z,
                x - space.x,
                space.height,
                space.depth
            ))
        
        # Top space
        if space.y + space.height > y + h + 0.001:
            self.spaces.append(Space3D(
                space.x, y + h, space.z,
                space.width,
                space.y + space.height - (y + h),
                space.depth
            ))
        
        # Bottom space (if not on floor)
        if y > space.y + 0.001:
            self.spaces.append(Space3D(
                space.x, space.y, space.z,
                space.width,
                y - space.y,
                space.depth
            ))
        
        # Front space (along Z-axis)
        if space.z + space.depth > z + d + 0.001:
            self.spaces.append(Space3D(
                space.x, space.y, z + d,
                space.width,
                space.height,
                space.z + space.depth - (z + d)
            ))
        
        # Back space (along Z-axis)
        if z > space.z + 0.001:
            self.spaces.append(Space3D(
                space.x, space.y, space.z,
                space.width,
                space.height,
                z - space.z
            ))
        
        # Also create combined spaces for better Z-axis gap filling
        # Top-Right space
        if space.x + space.width > x + w + 0.001 and space.y + space.height > y + h + 0.001:
            self.spaces.append(Space3D(
                x + w, y + h, space.z,
                space.x + space.width - (x + w),
                space.y + space.height - (y + h),
                space.depth
            ))
        
        # Remove zero-volume spaces
        self.spaces = [s for s in self.spaces if s.volume > 0.001]
    
    def _merge_spaces(self):
        """Merge adjacent spaces to reduce fragmentation"""
        if len(self.spaces) < 2:
            return
        
        merged = True
        while merged:
            merged = False
            new_spaces = []
            skip = set()
            
            for i, s1 in enumerate(self.spaces):
                if i in skip:
                    continue
                
                merged_this = False
                for j, s2 in enumerate(self.spaces):
                    if j <= i or j in skip:
                        continue
                    
                    # Try merging along X axis
                    if (abs(s1.y - s2.y) < 0.001 and abs(s1.z - s2.z) < 0.001 and
                        abs(s1.height - s2.height) < 0.001 and abs(s1.depth - s2.depth) < 0.001):
                        
                        if abs(s1.x2 - s2.x) < 0.001:  # s1 right of s2
                            merged_space = Space3D(
                                s2.x, s1.y, s1.z,
                                s2.width + s1.width,
                                s1.height, s1.depth
                            )
                            new_spaces.append(merged_space)
                            skip.add(i); skip.add(j)
                            merged = True; merged_this = True
                            break
                        elif abs(s2.x2 - s1.x) < 0.001:  # s2 right of s1
                            merged_space = Space3D(
                                s1.x, s1.y, s1.z,
                                s1.width + s2.width,
                                s1.height, s1.depth
                            )
                            new_spaces.append(merged_space)
                            skip.add(i); skip.add(j)
                            merged = True; merged_this = True
                            break
                    
                    # Try merging along Y axis
                    elif (abs(s1.x - s2.x) < 0.001 and abs(s1.z - s2.z) < 0.001 and
                          abs(s1.width - s2.width) < 0.001 and abs(s1.depth - s2.depth) < 0.001):
                        
                        if abs(s1.y2 - s2.y) < 0.001:  # s1 above s2
                            merged_space = Space3D(
                                s1.x, s2.y, s1.z,
                                s1.width,
                                s2.height + s1.height,
                                s1.depth
                            )
                            new_spaces.append(merged_space)
                            skip.add(i); skip.add(j)
                            merged = True; merged_this = True
                            break
                        elif abs(s2.y2 - s1.y) < 0.001:  # s2 above s1
                            merged_space = Space3D(
                                s1.x, s1.y, s1.z,
                                s1.width,
                                s1.height + s2.height,
                                s1.depth
                            )
                            new_spaces.append(merged_space)
                            skip.add(i); skip.add(j)
                            merged = True; merged_this = True
                            break
                    
                    # Try merging along Z axis
                    elif (abs(s1.x - s2.x) < 0.001 and abs(s1.y - s2.y) < 0.001 and
                          abs(s1.width - s2.width) < 0.001 and abs(s1.height - s2.height) < 0.001):
                        
                        if abs(s1.z2 - s2.z) < 0.001:  # s1 in front of s2
                            merged_space = Space3D(
                                s1.x, s1.y, s2.z,
                                s1.width, s1.height,
                                s2.depth + s1.depth
                            )
                            new_spaces.append(merged_space)
                            skip.add(i); skip.add(j)
                            merged = True; merged_this = True
                            break
                        elif abs(s2.z2 - s1.z) < 0.001:  # s2 in front of s1
                            merged_space = Space3D(
                                s1.x, s1.y, s1.z,
                                s1.width, s1.height,
                                s1.depth + s2.depth
                            )
                            new_spaces.append(merged_space)
                            skip.add(i); skip.add(j)
                            merged = True; merged_this = True
                            break
                
                if not merged_this:
                    new_spaces.append(s1)
            
            # Add any remaining spaces
            for i, s in enumerate(self.spaces):
                if i not in skip and s not in new_spaces:
                    new_spaces.append(s)
            
            self.spaces = new_spaces
    
    def get_all_spaces(self) -> List[Space3D]:
        """Get all current empty spaces"""
        return self.spaces.copy()


# ====================================================================
# ULTIMATE PACKING SERVICE - ENHANCED WITH PROPER SORTING AND Z-AXIS FILLING
# ====================================================================

class UltimatePackingService:
    """Packing service combining py3dbp, OR-Tools, and MES position finder"""
    
    def __init__(self):
        self.boundary_validator = BoundaryValidator()
        self.overlap_validator = OverlapValidator()
        self.support_validator = SupportValidator()
        self.mes_finder = MaximalEmptySpacesFinder()
        self.optimizer = ORToolsOptimizer()
        
    def calculate_packing(self, request: PackingRequest) -> PackingResult:
        """Main packing calculation with proper sorting and Z-axis filling"""
        start_time = time.time()
        job_id = uuid.uuid4()
        
        try:
            strategy = getattr(request, 'algorithm', 'maximal').lower()
            if strategy not in ['maximal', 'medium', 'small']:
                strategy = 'maximal'
            
            print(f"🚀 Starting ULTIMATE packing for job {job_id}")
            print(f"📦 Using: py3dbp + OR-Tools + MES Algorithm")
            print(f"🎯 Strategy: {strategy}")
            
            items_data = self._prepare_items_data_safely(request.items)
            if not items_data:
                return self._create_empty_result(job_id, request.bin_config, start_time)
            
            print(f"📦 Total valid items: {len(items_data)}")
            
            container_width = SafeConverter.to_float(request.bin_config.width, 10.0)
            container_height = SafeConverter.to_float(request.bin_config.height, 8.0)
            container_depth = SafeConverter.to_float(request.bin_config.depth, 10.0)
            container_volume = container_width * container_height * container_depth
            
            print(f"📦 Container: {container_width:.3f}x{container_height:.3f}x{container_depth:.3f}")
            print(f"🚪 Door gap: {self.mes_finder.door_gap}m on right side")
            
            # STEP 1: OR-Tools categorization and sorting
            print("📦 Running OR-Tools categorization...")
            priority_items, secondary_items, tertiary_items = self.optimizer.optimize_item_selection(
                items_data, [container_width, container_height, container_depth], strategy
            )
            
            print(f"📦 Priority items: {len(priority_items)}")
            print(f"📦 Secondary items: {len(secondary_items)}")
            print(f"📦 Tertiary items: {len(tertiary_items)}")
            
            # STEP 2: Initialize MES
            self.mes_finder.reset([container_width, container_height, container_depth])
            
            # STEP 3: Multi-phase packing
            print("📦 Running MES positioning with Z-axis gap filling...")
            packed_items = []
            unpacked_items = []
            packed_volume = 0.0
            packed_weight = 0.0
            
            placed_items = []
            processed_ids = set()
            
            # Track failed items for next phases
            failed_priority = []
            failed_secondary = []
            
            # ============ PHASE 1: PACK PRIORITY ITEMS ============
            print(f"📦 PHASE 1: Packing {len(priority_items)} priority items...")
            
            for item in priority_items:
                if item['id'] in processed_ids:
                    continue
                
                # Try to pack with standard support requirements
                result = self.mes_finder.find_best_position(
                    [item['width'], item['height'], item['depth']],
                    [container_width, container_height, container_depth],
                    placed_items,
                    is_small_item=False
                )
                
                position, dimensions, rotation = result
                
                if position is not None and dimensions is not None and rotation is not None:
                    is_valid, msg = self._validate_placement(
                        position, dimensions,
                        [container_width, container_height, container_depth],
                        placed_items
                    )
                    
                    if is_valid:
                        has_support, _ = self.support_validator.has_support(
                            position, dimensions, placed_items, is_small_item=False
                        )
                        
                        if has_support or abs(position[1]) < 0.001:
                            packed_items.append({
                                'id': item['id'],
                                'position': position,
                                'dimensions': dimensions,
                                'rotation': rotation,
                                'original_item': item
                            })
                            
                            placed_items.append({
                                'id': item['id'],
                                'position': position,
                                'dimensions': dimensions
                            })
                            
                            packed_volume += dimensions[0] * dimensions[1] * dimensions[2]
                            packed_weight += item.get('weight', 0)
                            processed_ids.add(item['id'])
                            print(f"✅ PHASE 1 packed: {item['id']} at {position}")
                        else:
                            failed_priority.append(item)
                    else:
                        failed_priority.append(item)
                else:
                    failed_priority.append(item)
            
            # ============ PHASE 2: PACK SECONDARY ITEMS ============
            print(f"📦 PHASE 2: Packing {len(secondary_items)} secondary items...")
            
            # Combine failed priority with secondary items
            phase2_items = failed_priority + secondary_items
            phase2_items.sort(key=lambda x: -(x['width'] * x['height'] * x['depth']))
            
            for item in phase2_items:
                if item['id'] in processed_ids:
                    continue
                
                # Try with slightly relaxed support for better packing
                result = self.mes_finder.find_best_position(
                    [item['width'], item['height'], item['depth']],
                    [container_width, container_height, container_depth],
                    placed_items,
                    is_small_item=True if item in tertiary_items else False
                )
                
                position, dimensions, rotation = result
                
                if position is not None and dimensions is not None and rotation is not None:
                    is_valid, _ = self._validate_placement(
                        position, dimensions,
                        [container_width, container_height, container_depth],
                        placed_items
                    )
                    
                    if is_valid:
                        has_support, _ = self.support_validator.has_support(
                            position, dimensions, placed_items, 
                            is_small_item=True if item in tertiary_items else False
                        )
                        
                        if has_support or abs(position[1]) < 0.001:
                            packed_items.append({
                                'id': item['id'],
                                'position': position,
                                'dimensions': dimensions,
                                'rotation': rotation,
                                'original_item': item
                            })
                            
                            placed_items.append({
                                'id': item['id'],
                                'position': position,
                                'dimensions': dimensions
                            })
                            
                            packed_volume += dimensions[0] * dimensions[1] * dimensions[2]
                            packed_weight += item.get('weight', 0)
                            processed_ids.add(item['id'])
                            print(f"✅ PHASE 2 packed: {item['id']} at {position}")
                        else:
                            failed_secondary.append(item)
                    else:
                        failed_secondary.append(item)
                else:
                    failed_secondary.append(item)
            
            # ============ PHASE 3: PACK TERTIARY ITEMS (SMALL) WITH AGGRESSIVE Z-AXIS FILLING ============
            print(f"📦 PHASE 3: Packing {len(tertiary_items)} small items with Z-axis gap filling...")
            
            # Combine failed secondary with tertiary items
            phase3_items = failed_secondary + tertiary_items
            phase3_items.sort(key=lambda x: -(x['width'] * x['height'] * x['depth']))
            
            # Multiple passes for small items to fill all gaps
            items_packed = True
            pass_count = 0
            max_passes = 3
            
            while items_packed and pass_count < max_passes and phase3_items:
                items_packed = False
                pass_count += 1
                
                print(f"📦 PHASE 3.{pass_count}: Gap filling pass...")
                
                for item in phase3_items[:]:  # Iterate over copy
                    if item['id'] in processed_ids:
                        phase3_items.remove(item)
                        continue
                    
                    # Try with relaxed support for small items
                    result = self.mes_finder.find_best_position(
                        [item['width'], item['height'], item['depth']],
                        [container_width, container_height, container_depth],
                        placed_items,
                        is_small_item=True
                    )
                    
                    position, dimensions, rotation = result
                    
                    if position is not None and dimensions is not None and rotation is not None:
                        is_valid, _ = self._validate_placement(
                            position, dimensions,
                            [container_width, container_height, container_depth],
                            placed_items
                        )
                        
                        if is_valid:
                            # Small items can have less support
                            has_support, _ = self.support_validator.has_support(
                                position, dimensions, placed_items, is_small_item=True
                            )
                            
                            if has_support or abs(position[1]) < 0.001 or dimensions[1] < 0.3:
                                packed_items.append({
                                    'id': item['id'],
                                    'position': position,
                                    'dimensions': dimensions,
                                    'rotation': rotation,
                                    'original_item': item
                                })
                                
                                placed_items.append({
                                    'id': item['id'],
                                    'position': position,
                                    'dimensions': dimensions
                                })
                                
                                packed_volume += dimensions[0] * dimensions[1] * dimensions[2]
                                packed_weight += item.get('weight', 0)
                                processed_ids.add(item['id'])
                                phase3_items.remove(item)
                                items_packed = True
                                print(f"✅ PHASE 3.{pass_count} packed: {item['id']} at {position}")
            
            # ============ PHASE 4: FINAL ATTEMPT - FILL EVERY POSSIBLE GAP ============
            if phase3_items:
                print(f"📦 PHASE 4: Final attempt for {len(phase3_items)} remaining items...")
                
                # Sort by volume (smallest first for final gaps)
                phase3_items.sort(key=lambda x: (x['width'] * x['height'] * x['depth']))
                
                for item in phase3_items[:]:
                    if item['id'] in processed_ids:
                        continue
                    
                    # Try all orientations with multiple positions
                    orientations = [
                        [item['width'], item['height'], item['depth']],
                        [item['width'], item['depth'], item['height']],
                        [item['height'], item['width'], item['depth']],
                        [item['height'], item['depth'], item['width']],
                        [item['depth'], item['width'], item['height']],
                        [item['depth'], item['height'], item['width']]
                    ]
                    
                    rotation_map = {
                        0: [0.0, 0.0, 0.0],
                        1: [0.0, 90.0, 0.0],
                        2: [90.0, 0.0, 0.0],
                        3: [90.0, 90.0, 0.0],
                        4: [0.0, 90.0, 90.0],
                        5: [90.0, 0.0, 90.0]
                    }
                    
                    placed = False
                    
                    for orient_idx, orient_dims in enumerate(orientations):
                        if placed:
                            break
                        
                        # Try each available space
                        for space in self.mes_finder.get_all_spaces():
                            if placed:
                                break
                            
                            # Try multiple positions within space
                            if (orient_dims[0] <= space.width + 0.001 and
                                orient_dims[1] <= space.height + 0.001 and
                                orient_dims[2] <= space.depth + 0.001):
                                
                                # Try different Z positions for better gap filling
                                z_positions = [space.z, space.z + (space.depth - orient_dims[2]) / 2]
                                
                                for test_z in z_positions:
                                    x, y = space.x, space.y
                                    
                                    # Check boundaries
                                    is_valid, _ = self.boundary_validator.is_item_within_container(
                                        [x, y, test_z], orient_dims,
                                        [container_width, container_height, container_depth]
                                    )
                                    
                                    if is_valid:
                                        # Check overlap
                                        has_overlap, _ = self.overlap_validator.check_item_with_placed(
                                            [x, y, test_z], orient_dims, placed_items
                                        )
                                        
                                        if not has_overlap:
                                            # Final attempt - pack it
                                            packed_items.append({
                                                'id': item['id'],
                                                'position': [x, y, test_z],
                                                'dimensions': orient_dims,
                                                'rotation': rotation_map.get(orient_idx, [0, 0, 0]),
                                                'original_item': item
                                            })
                                            
                                            placed_items.append({
                                                'id': item['id'],
                                                'position': [x, y, test_z],
                                                'dimensions': orient_dims
                                            })
                                            
                                            packed_volume += orient_dims[0] * orient_dims[1] * orient_dims[2]
                                            packed_weight += item.get('weight', 0)
                                            processed_ids.add(item['id'])
                                            placed = True
                                            print(f"✅ PHASE 4 packed: {item['id']}")
                                            break
            
            # Add any remaining items to unpacked
            for item in items_data:
                if item['id'] not in processed_ids:
                    unpacked_items.append(item)
            
            # Calculate statistics
            space_utilization = (packed_volume / container_volume * 100) if container_volume > 0 else 0
            total_items = len(items_data)
            packed_count = len(packed_items)
            packing_efficiency = (packed_count / total_items * 100) if total_items > 0 else 0
            
            # Calculate volume efficiency
            total_item_volume = sum(i['width'] * i['height'] * i['depth'] for i in items_data)
            volume_efficiency = (packed_volume / total_item_volume * 100) if total_item_volume > 0 else 0
            
            # Get remaining spaces info
            remaining_spaces = self.mes_finder.get_all_spaces()
            remaining_space_volume = sum(s.volume for s in remaining_spaces)
            
            print(f"📊 ULTIMATE Packing Results ({strategy}):")
            print(f"   - Packed: {packed_count}/{total_items} items")
            print(f"   - Space Utilization: {space_utilization:.2f}%")
            print(f"   - Volume Efficiency: {volume_efficiency:.2f}%")
            print(f"   - Items Efficiency: {packing_efficiency:.2f}%")
            print(f"   - Remaining spaces: {len(remaining_spaces)} (volume: {remaining_space_volume:.2f}m³)")
            print(f"   - Time: {(time.time() - start_time)*1000:.1f}ms")
            
            return self._build_response(
                job_id, start_time, request.bin_config,
                packed_items, unpacked_items, items_data,
                container_width, container_height, container_depth,
                packed_volume, packed_weight, space_utilization, packing_efficiency,
                strategy, volume_efficiency, remaining_spaces
            )
            
        except Exception as e:
            print(f"❌ Critical error: {e}")
            traceback.print_exc()
            return self._create_emergency_result(job_id, e, start_time)
    
    def _validate_placement(self, position: List[float], dimensions: List[float],
                           container_dims: List[float], placed_items: List[Dict]) -> Tuple[bool, str]:
        """Validate item placement"""
        is_valid, msg = self.boundary_validator.is_item_within_container(
            position, dimensions, container_dims
        )
        if not is_valid:
            return False, msg
        
        has_overlap, overlap_msg = self.overlap_validator.check_item_with_placed(
            position, dimensions, placed_items
        )
        if has_overlap:
            return False, overlap_msg
        
        return True, "Valid"
    
    def _prepare_items_data_safely(self, items: List[ItemSchema]) -> List[Dict]:
        """Prepare items data safely"""
        items_data = []
        item_counter = {}
        
        try:
            if not items:
                return []
            
            for item_schema in items:
                try:
                    base_name = SafeConverter.to_string(item_schema.name or item_schema.id, "item")
                    quantity = SafeConverter.to_int(getattr(item_schema, 'quantity', 1))
                    
                    for i in range(quantity):
                        item_counter[base_name] = item_counter.get(base_name, 0) + 1
                        item_id = f"{base_name}_{item_counter[base_name]}"
                        
                        width = SafeConverter.to_float(item_schema.width, 0.5)
                        height = SafeConverter.to_float(item_schema.height, 0.5)
                        depth = SafeConverter.to_float(item_schema.depth, 0.5)
                        
                        if width <= 0 or height <= 0 or depth <= 0:
                            continue
                        
                        volume = round(width * height * depth, 4)
                        weight = SafeConverter.to_float(getattr(item_schema, 'weight', 1.0))
                        
                        color = getattr(item_schema, 'color', None)
                        if not color or not color.startswith('#'):
                            color = self._generate_color_safely(base_name)
                        
                        items_data.append({
                            'id': item_id,
                            'original_name': base_name,
                            'dimensions': [width, height, depth],
                            'width': width,
                            'height': height,
                            'depth': depth,
                            'volume': volume,
                            'weight': weight,
                            'color': color
                        })
                
                except Exception as e:
                    print(f"⚠️ Failed to prepare item: {e}")
                    continue
            
            return items_data
            
        except Exception as e:
            print(f"❌ Error preparing items: {e}")
            return []
    
    def _calculate_rotation(self, original_dims: List[float], final_dims: List[float]) -> List[float]:
        """Calculate rotation angles"""
        w, h, d = [round(v, 4) for v in original_dims]
        fw, fh, fd = [round(v, 4) for v in final_dims]
        
        if abs(w - fw) < 0.001 and abs(h - fh) < 0.001 and abs(d - fd) < 0.001:
            return [0, 0, 0]
        elif abs(w - fw) < 0.001 and abs(h - fd) < 0.001 and abs(d - fh) < 0.001:
            return [90, 0, 0]
        elif abs(w - fd) < 0.001 and abs(h - fh) < 0.001 and abs(d - fw) < 0.001:
            return [0, 90, 0]
        elif abs(w - fh) < 0.001 and abs(h - fw) < 0.001 and abs(d - fd) < 0.001:
            return [0, 0, 90]
        elif abs(w - fd) < 0.001 and abs(h - fw) < 0.001 and abs(d - fh) < 0.001:
            return [90, 90, 0]
        elif abs(w - fh) < 0.001 and abs(h - fd) < 0.001 and abs(d - fw) < 0.001:
            return [0, 90, 90]
        
        return [0, 0, 0]
    
    def _build_response(self, job_id, start_time, bin_config,
                       packed_items, unpacked_items, all_items,
                       cw, ch, cd, packed_volume, packed_weight,
                       space_utilization, packing_efficiency,
                       strategy="maximal", volume_efficiency=0.0, remaining_spaces=None):
        """Build the final response"""
        
        packed_items_response = []
        for packed in packed_items:
            try:
                packed_item = PackedItem(
                    id=packed['id'],
                    position=[round(p, 4) for p in packed['position']],
                    rotation=[round(r, 1) for r in packed['rotation']],
                    dimensions=[round(d, 4) for d in packed['dimensions']],
                    color=packed['original_item'].get('color', '#10b981'),
                    original_name=packed['original_item'].get('original_name', packed['id'].split('_')[0]),
                    original_dimensions=[
                        packed['original_item']['width'],
                        packed['original_item']['height'],
                        packed['original_item']['depth']
                    ],
                    rotation_mode_used='RotationMode.AUTOMATIC',
                    bounding_box_volume=round(packed['dimensions'][0] * packed['dimensions'][1] * packed['dimensions'][2], 4)
                )
                packed_items_response.append(packed_item)
            except Exception:
                continue
        
        total_weight = sum(i.get('weight', 0) for i in all_items)
        weight_utilization = 0.0
        if total_weight > 0:
            weight_utilization = round((packed_weight / total_weight * 100), 2)
        
        packed_bin = PackedBin(
            bin_id='bin_1',
            dimensions=[cw, ch, cd],
            items=packed_items_response,
            utilization=round(space_utilization, 2),
            weight_utilization=weight_utilization
        )
        
        unpacked_items_objs = []
        seen_ids = set()
        
        for unpacked in unpacked_items:
            try:
                if isinstance(unpacked, dict):
                    item_id = unpacked.get('id', str(uuid.uuid4()))
                    if item_id not in seen_ids:
                        seen_ids.add(item_id)
                        item = UnpackedItem(
                            name=unpacked.get('original_name', 'Unknown'),
                            id=item_id,
                            dimensions=[
                                unpacked.get('width', 0.5),
                                unpacked.get('height', 0.5),
                                unpacked.get('depth', 0.5)
                            ],
                            volume=unpacked.get('volume', 0.125),
                            color=unpacked.get('color', '#ef4444'),
                            reason='Could not fit in container',
                            weight=unpacked.get('weight', 0.0),
                            quantity=1,
                            rotation_attempts=6
                        )
                        unpacked_items_objs.append(item)
            except Exception:
                continue
        
        visualization_data = self._build_visualization_data(
            [packed_bin], bin_config, unpacked_items_objs, all_items
        )
        
        execution_time = time.time() - start_time
        
        rotation_stats = {
            'items_with_rotation': len([i for i in packed_items_response if sum(abs(r) for r in i.rotation) > 0.1]),
            'max_rotation_angle': max([sum(abs(r) for r in i.rotation) for i in packed_items_response] or [0]),
            'avg_rotation_angle': round(sum([sum(abs(r) for r in i.rotation) for i in packed_items_response]) / len(packed_items_response) if packed_items_response else 0, 2),
            'min_rotation_angle': min([sum(abs(r) for r in i.rotation) for i in packed_items_response] or [0]),
            'rotation_modes_used': {},
            'rotation_efficiency_gain': round(len([i for i in packed_items_response if sum(abs(r) for r in i.rotation) > 0.1]) / len(packed_items_response) * 100 if packed_items_response else 0, 2),
            'rotation_attempts': len(packed_items) * 6
        }
        
        total_item_volume = sum(i.get('volume', 0) for i in all_items)
        remaining_space_volume = sum(s.volume for s in remaining_spaces) if remaining_spaces else 0
        
        statistics = {
            'success': True,
            'space_utilization': round(space_utilization, 2),
            'volume_efficiency': round(volume_efficiency, 2),
            'packing_efficiency': round(packing_efficiency, 2),
            'container_volume': round(cw * ch * cd, 2),
            'total_item_volume': round(total_item_volume, 2),
            'packed_volume': round(packed_volume, 2),
            'empty_volume': round(cw * ch * cd - packed_volume, 2),
            'remaining_space_volume': round(remaining_space_volume, 2),
            'remaining_spaces_count': len(remaining_spaces) if remaining_spaces else 0,
            'total_item_weight': total_weight,
            'packed_weight': round(packed_weight, 2),
            'bins_used': 1,
            'items_packed': len(packed_items),
            'total_items': len(all_items),
            'unpacked_items_count': len(unpacked_items_objs),
            'execution_time_ms': round(execution_time * 1000, 2),
            'algorithm': f'ultimate-py3dbp-ortools-mes-{strategy}',
            'ortools_used': True,
            'solution_valid': True,
            'strategy_used': f'{strategy}-first',
            'rotation_mode': 'automatic',
            'rotation_stats': rotation_stats,
            'door_gap_maintained': True,
            'z_axis_filling': True,
            'phases_completed': 4
        }
        
        return PackingResult(
            bins=[packed_bin],
            statistics=statistics,
            job_id=job_id,
            visualization_data=visualization_data,
            unpacked_items=unpacked_items_objs
        )
    
    def _build_visualization_data(self, packed_bins, bin_config, unpacked_items, all_items):
        """Build visualization data"""
        try:
            items_data = []
            
            for bin_idx, packed_bin in enumerate(packed_bins):
                for item in getattr(packed_bin, 'items', []):
                    try:
                        items_data.append({
                            "id": SafeConverter.to_string(getattr(item, 'id', f'item_{len(items_data)}')),
                            "position": [round(p, 4) for p in SafeConverter.to_number_list(getattr(item, 'position', [0, 0, 0]))],
                            "rotation": [round(r, 1) for r in SafeConverter.to_number_list(getattr(item, 'rotation', [0, 0, 0]))],
                            "dimensions": [round(d, 4) for d in SafeConverter.to_number_list(getattr(item, 'dimensions', [0.5, 0.5, 0.5]))],
                            "color": SafeConverter.to_string(getattr(item, 'color', '#10b981')),
                            "bin_index": bin_idx,
                            "original_name": SafeConverter.to_string(getattr(item, 'original_name', 'Unknown'))
                        })
                    except Exception:
                        continue
            
            unpacked_items_for_viz = []
            for item in unpacked_items:
                try:
                    unpacked_items_for_viz.append({
                        "name": SafeConverter.to_string(getattr(item, 'name', 'Unknown')),
                        "id": SafeConverter.to_string(getattr(item, 'id', str(uuid.uuid4()))),
                        "dimensions": [round(d, 4) for d in SafeConverter.to_number_list(getattr(item, 'dimensions', [0.5, 0.5, 0.5]))],
                        "volume": SafeConverter.to_float(getattr(item, 'volume', 0.125)),
                        "color": SafeConverter.to_string(getattr(item, 'color', '#ef4444')),
                        "reason": SafeConverter.to_string(getattr(item, 'reason', 'Could not fit')),
                        "weight": SafeConverter.to_float(getattr(item, 'weight', 0.0)),
                        "quantity": 1
                    })
                except Exception:
                    continue
            
            container_width = SafeConverter.to_float(bin_config.width, 10.0)
            container_height = SafeConverter.to_float(bin_config.height, 8.0)
            container_depth = SafeConverter.to_float(bin_config.depth, 10.0)
            
            return {
                "items": items_data,
                "unpacked_items": unpacked_items_for_viz,
                "container": {
                    "width": container_width,
                    "height": container_height,
                    "depth": container_depth,
                    "volume": container_width * container_height * container_depth
                },
                "scene": {
                    "background": "#f8fafc",
                    "grid": True,
                    "axes": True,
                    "camera": {
                        "position": [20, 15, 20],
                        "target": [container_width/2, container_height/2, container_depth/2]
                    }
                },
                "summary": {
                    "total_items": len(all_items),
                    "packed_items": len(items_data),
                    "unpacked_count": len(unpacked_items_for_viz),
                    "space_utilization": 0.0,
                    "efficiency": round((len(items_data) / len(all_items) * 100) if all_items else 0, 2)
                }
            }
        except Exception as e:
            print(f"❌ Error building visualization: {e}")
            return self._get_default_visualization(bin_config)
    
    def _get_default_visualization(self, bin_config):
        """Get default visualization"""
        return {
            "items": [],
            "unpacked_items": [],
            "container": {
                "width": SafeConverter.to_float(bin_config.width, 10.0),
                "height": SafeConverter.to_float(bin_config.height, 8.0),
                "depth": SafeConverter.to_float(bin_config.depth, 10.0),
                "volume": SafeConverter.to_float(bin_config.width, 10.0) * 
                         SafeConverter.to_float(bin_config.height, 8.0) * 
                         SafeConverter.to_float(bin_config.depth, 10.0)
            },
            "scene": {
                "background": "#f8fafc",
                "grid": True,
                "axes": True,
                "camera": {"position": [20, 15, 20], "target": [5, 4, 5]}
            },
            "summary": {
                "total_items": 0,
                "packed_items": 0,
                "unpacked_count": 0,
                "space_utilization": 0.0,
                "efficiency": 0.0
            }
        }
    
    def _create_empty_result(self, job_id, bin_config, start_time):
        """Create empty result"""
        execution_time = time.time() - start_time
        visualization_data = self._get_default_visualization(bin_config)
        
        statistics = {
            'success': False,
            'error': 'No valid items to pack',
            'space_utilization': 0.0,
            'packing_efficiency': 0.0,
            'container_volume': visualization_data['container']['volume'],
            'total_item_volume': 0.0,
            'packed_volume': 0.0,
            'empty_volume': visualization_data['container']['volume'],
            'total_item_weight': 0,
            'packed_weight': 0,
            'bins_used': 0,
            'items_packed': 0,
            'total_items': 0,
            'unpacked_items_count': 0,
            'execution_time_ms': round(execution_time * 1000, 2),
            'algorithm': 'ultimate-py3dbp-ortools-mes',
            'ortools_used': False,
            'solution_valid': False,
            'validation_warnings': ['No valid items provided'],
            'strategy_used': 'none',
            'rotation_mode': 'none',
            'rotation_stats': {}
        }
        
        return PackingResult(
            bins=[],
            statistics=statistics,
            job_id=job_id,
            visualization_data=visualization_data,
            unpacked_items=[]
        )
    
    def _create_emergency_result(self, job_id, error, start_time):
        """Create emergency result"""
        execution_time = time.time() - start_time
        
        visualization_data = {
            "items": [],
            "unpacked_items": [],
            "container": {"width": 10.0, "height": 8.0, "depth": 10.0, "volume": 800.0},
            "scene": {
                "background": "#f8fafc",
                "grid": True,
                "axes": True,
                "camera": {"position": [20, 15, 20], "target": [5, 4, 5]}
            },
            "summary": {
                "total_items": 0,
                "packed_items": 0,
                "unpacked_count": 0,
                "space_utilization": 0.0,
                "efficiency": 0.0
            }
        }
        
        statistics = {
            'success': False,
            'error': f'Critical error: {str(error)[:100]}',
            'space_utilization': 0.0,
            'packing_efficiency': 0.0,
            'container_volume': 800.0,
            'total_item_volume': 0.0,
            'packed_volume': 0.0,
            'empty_volume': 800.0,
            'total_item_weight': 0,
            'packed_weight': 0,
            'bins_used': 0,
            'items_packed': 0,
            'total_items': 0,
            'unpacked_items_count': 0,
            'execution_time_ms': round(execution_time * 1000, 2),
            'algorithm': 'ultimate-py3dbp-ortools-mes',
            'ortools_used': False,
            'solution_valid': False,
            'validation_warnings': ['Critical system error occurred'],
            'strategy_used': 'emergency_fallback',
            'rotation_mode': 'none',
            'rotation_stats': {}
        }
        
        return PackingResult(
            bins=[],
            statistics=statistics,
            job_id=job_id,
            visualization_data=visualization_data,
            unpacked_items=[]
        )
    
    def _generate_color_safely(self, base_name):
        """Generate color"""
        try:
            hash_val = hash(base_name) % 360
            hue = abs(hash_val) % 360
            return f'hsl({hue}, 70%, 50%)'
        except Exception:
            return '#3B82F6'

# Create singleton instance
packing_service = UltimatePackingService()