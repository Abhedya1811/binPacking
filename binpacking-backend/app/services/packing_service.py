"""
COMPLETE FIX: Advanced Packing Algorithm with Proper Item Placement
"""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import List, Dict, Any, Optional, Tuple, Union
import time
import uuid
import numpy as np
from math import sin, cos, radians, degrees, pi
import random
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from py3dbp import Packer, Bin, Item
from app.schemas.packing import (
    ItemSchema, BinConfig, PackingRequest, 
    PackingResult, PackedBin, PackedItem, UnpackedItem, VisualizationData,
    RotationMode, RotationAxis, RotationConstraint
)

# ====================================================================
# TYPE SAFE CONVERTER
# ====================================================================

class TypeSafeConverter:
    """Type-safe converter with proper type annotations"""
    
    @staticmethod
    def to_float(value: Any, default: float = 0.0) -> float:
        """Convert any value to float safely with type annotation"""
        try:
            if value is None:
                return default
            if isinstance(value, Decimal):
                return float(value)
            if isinstance(value, (int, float, np.number)):
                return float(value)
            if isinstance(value, str):
                return float(value.strip())
            return float(value)
        except (ValueError, TypeError, AttributeError) as e:
            print(f"⚠️ TypeSafeConverter.to_float failed for {value}: {e}")
            return default
    
    @staticmethod
    def to_int(value: Any, default: int = 0) -> int:
        """Convert any value to int safely"""
        try:
            return int(TypeSafeConverter.to_float(value, default))
        except Exception as e:
            print(f"⚠️ TypeSafeConverter.to_int failed: {e}")
            return default
    
    @staticmethod
    def to_string(value: Any, default: str = "") -> str:
        """Convert any value to string safely"""
        try:
            if value is None:
                return default
            return str(value)
        except Exception as e:
            print(f"⚠️ TypeSafeConverter.to_string failed: {e}")
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
                # Convert all elements to float
                result: List[float] = []
                for item in value:
                    try:
                        result.append(float(item))
                    except (ValueError, TypeError):
                        result.append(0.0)
                
                # Ensure we have at least 3 elements
                while len(result) < 3:
                    result.append(0.0)
                
                # Return only first 3 elements
                return result[:3]
            
            # Single value? Create list with that value
            return [float(value), 0.0, 0.0]
            
        except Exception as e:
            print(f"⚠️ TypeSafeConverter.to_number_list failed: {e}")
            return default.copy() if default else [0.0, 0.0, 0.0]

SafeConverter = TypeSafeConverter

# ====================================================================
# FIXED BOUNDARY VALIDATOR
# ====================================================================

class BoundaryValidator:
    """Validates items stay within container boundaries - No exceptions!"""
    
    @staticmethod
    def is_item_within_container(item_pos: List[float], item_dims: List[float], 
                                container_dims: List[float], tolerance: float = 0.001) -> bool:
        """Check if item is completely within container - SAFE"""
        try:
            # Ensure we have at least 3 elements in each list
            if len(item_pos) < 3:
                item_pos = item_pos + [0.0] * (3 - len(item_pos))
            if len(item_dims) < 3:
                item_dims = item_dims + [0.0] * (3 - len(item_dims))
            if len(container_dims) < 3:
                container_dims = container_dims + [0.0] * (3 - len(container_dims))
            
            # Convert all values to float safely
            x = SafeConverter.to_float(item_pos[0])
            y = SafeConverter.to_float(item_pos[1])
            z = SafeConverter.to_float(item_pos[2])
            
            w = SafeConverter.to_float(item_dims[0])
            h = SafeConverter.to_float(item_dims[1])
            d = SafeConverter.to_float(item_dims[2])
            
            cw = SafeConverter.to_float(container_dims[0])
            ch = SafeConverter.to_float(container_dims[1])
            cd = SafeConverter.to_float(container_dims[2])
            
            # Validate values
            if any(v < 0 for v in [w, h, d, cw, ch, cd]):
                print(f"⚠️ Negative dimensions detected")
                return False
            
            # IMPORTANT FIX: Check boundaries with proper floating point comparison
            # Allow small tolerance for floating point errors
            within_x = (x >= -tolerance) and ((x + w) <= (cw + tolerance))
            within_y = (y >= -tolerance) and ((y + h) <= (ch + tolerance))
            within_z = (z >= -tolerance) and ((z + d) <= (cd + tolerance))
            
            # Debug output for boundary violations
            if not within_x:
                print(f"❌ X boundary violation: x={x}, w={w}, x+w={x+w}, cw={cw}")
            if not within_y:
                print(f"❌ Y boundary violation: y={y}, h={h}, y+h={y+h}, ch={ch}")
            if not within_z:
                print(f"❌ Z boundary violation: z={z}, d={d}, z+d={z+d}, cd={cd}")
            
            return within_x and within_y and within_z
            
        except Exception as e:
            print(f"❌ BoundaryValidator.is_item_within_container error: {e}")
            return False
    
    @staticmethod
    def get_safe_position(item_pos: List[float], container_dims: List[float], 
                         item_dims: List[float]) -> List[float]:
        """Get a safe position within container bounds"""
        try:
            # Ensure lists have at least 3 elements
            if len(container_dims) < 3:
                container_dims = container_dims + [10.0, 8.0, 10.0][len(container_dims):]
            if len(item_dims) < 3:
                item_dims = item_dims + [0.5, 0.5, 0.5][len(item_dims):]
            if len(item_pos) < 3:
                item_pos = item_pos + [0.0, 0.0, 0.0][len(item_pos):]
            
            cw = SafeConverter.to_float(container_dims[0])
            ch = SafeConverter.to_float(container_dims[1])
            cd = SafeConverter.to_float(container_dims[2])
            
            w = SafeConverter.to_float(item_dims[0])
            h = SafeConverter.to_float(item_dims[1])
            d = SafeConverter.to_float(item_dims[2])
            
            # Default position
            safe_x = SafeConverter.to_float(item_pos[0])
            safe_y = SafeConverter.to_float(item_pos[1])
            safe_z = SafeConverter.to_float(item_pos[2])
            
            # Ensure within bounds with small margin
            margin = 0.001  # Small margin for floating point errors
            
            safe_x = max(margin, min(safe_x, cw - w - margin))
            safe_y = max(margin, min(safe_y, ch - h - margin))
            safe_z = max(margin, min(safe_z, cd - d - margin))
            
            # Ensure we don't end up with negative values
            safe_x = max(0.0, safe_x)
            safe_y = max(0.0, safe_y)
            safe_z = max(0.0, safe_z)
            
            return [safe_x, safe_y, safe_z]
            
        except Exception as e:
            print(f"❌ BoundaryValidator.get_safe_position error: {e}")
            return [0.0, 0.0, 0.0]

# ====================================================================
# COMPLETE FIX: NEW ADVANCED PACKING ALGORITHM
# ====================================================================

class AdvancedPackingAlgorithm:
    """IMPROVED: Better 3D packing with gap filling"""
    
    def pack_items(self, container_dims, items):
        """Pack items using improved 3D bin packing"""
        container_width, container_height, container_depth = container_dims
        
        print(f"📦 Packing into container: {container_width}x{container_height}x{container_depth}")
        
        # Sort by multiple criteria for better packing
        sorted_items = sorted(
            items,
            key=lambda x: (
                -max(x['dimensions']),  # Largest dimension first
                -x['volume'],           # Volume second
                min(x['dimensions'])    # Smallest dimension third
            )
        )
        
        packed_items = []
        occupied_spaces = []
        
        # Create 3D grid for tracking space
        grid_resolution = 0.5  # 0.5 unit grid
        grid_x = int(container_width / grid_resolution)
        grid_y = int(container_height / grid_resolution)
        grid_z = int(container_depth / grid_resolution)
        
        # Initialize occupancy grid
        occupancy_grid = np.zeros((grid_x, grid_y, grid_z), dtype=bool)
        
        for item in sorted_items:
            item_id = item['id']
            orig_width, orig_height, orig_depth = item['dimensions']
            placed = False
            
            # Try all 6 orientations
            orientations = [
                (orig_width, orig_height, orig_depth, [0, 0, 0]),
                (orig_width, orig_depth, orig_height, [0, 90, 0]),   # Rotate Y
                (orig_height, orig_width, orig_depth, [0, 0, 90]),   # Rotate Z
                (orig_height, orig_depth, orig_width, [90, 0, 0]),   # Rotate X
                (orig_depth, orig_width, orig_height, [90, 90, 0]),  # Rotate X+Y
                (orig_depth, orig_height, orig_width, [0, 90, 90]),  # Rotate Y+Z
            ]
            
            # Try different placement strategies
            placement_strategies = [
                'bottom_left_front',  # Traditional
                'lowest_z',           # Fill bottom first
                'wall_first',         # Along walls
                'gap_filling',        # Try to fill gaps
            ]
            
            for strategy in placement_strategies:
                if placed:
                    break
                    
                for w, h, d, rotation in orientations:
                    if placed:
                        break
                    
                    # Check if item fits in container at all
                    if w > container_width or h > container_height or d > container_depth:
                        continue
                    
                    # Try to find position using current strategy
                    position = self._find_position_with_strategy(
                        w, h, d,
                        container_width, container_height, container_depth,
                        occupancy_grid, grid_resolution,
                        strategy
                    )
                    
                    if position:
                        x, y, z = position
                        
                        # Verify no overlaps (safety check)
                        overlaps = False
                        for ox, oy, oz, ow, oh, od in occupied_spaces:
                            if (x < ox + ow and x + w > ox and
                                y < oy + oh and y + h > oy and
                                z < oz + od and z + d > oz):
                                overlaps = True
                                break
                        
                        if not overlaps:
                            # Mark space as occupied
                            occupied_spaces.append((x, y, z, w, h, d))
                            
                            # Update occupancy grid
                            grid_x_start = int(x / grid_resolution)
                            grid_y_start = int(y / grid_resolution)
                            grid_z_start = int(z / grid_resolution)
                            grid_x_end = int((x + w) / grid_resolution)
                            grid_y_end = int((y + h) / grid_resolution)
                            grid_z_end = int((z + d) / grid_resolution)
                            
                            # Ensure indices are within bounds
                            grid_x_end = min(grid_x_end, grid_x)
                            grid_y_end = min(grid_y_end, grid_y)
                            grid_z_end = min(grid_z_end, grid_z)
                            
                            occupancy_grid[grid_x_start:grid_x_end,
                                         grid_y_start:grid_y_end,
                                         grid_z_start:grid_z_end] = True
                            
                            packed_items.append({
                                'id': item_id,
                                'position': [x, y, z],
                                'dimensions': [w, h, d],
                                'rotation': rotation,
                                'original_item': item
                            })
                            
                            placed = True
                            print(f"✅ Packed {item_id} at [{x:.2f}, {y:.2f}, {z:.2f}] (strategy: {strategy})")
                            break
        
        print(f"📊 Packed {len(packed_items)}/{len(items)} items")
        return packed_items
    
    def _find_position_with_strategy(self, w, h, d, cw, ch, cd, occupancy_grid, grid_res, strategy):
        """Find position using different strategies"""
        grid_x_size, grid_y_size, grid_z_size = occupancy_grid.shape
        
        
        grid_w = max(1, int(w / grid_res))
        grid_h = max(1, int(h / grid_res))
        grid_d = max(1, int(d / grid_res))
        
        if strategy == 'lowest_z':
            
            for z in range(grid_z_size - grid_d + 1):
                for y in range(grid_y_size - grid_h + 1):
                    for x in range(grid_x_size - grid_w + 1):
                        if self._can_place(x, y, z, grid_w, grid_h, grid_d, occupancy_grid):
                            return x * grid_res, y * grid_res, z * grid_res
        
        elif strategy == 'wall_first':
            # Try along walls (X=0, Y=0, Z=0)
            walls = [
                (0, range(grid_y_size - grid_h + 1), range(grid_z_size - grid_d + 1)),  # X=0
                (range(grid_x_size - grid_w + 1), 0, range(grid_z_size - grid_d + 1)),  # Y=0
                (range(grid_x_size - grid_w + 1), range(grid_y_size - grid_h + 1), 0),  # Z=0
            ]
            
            for wall in walls:
                x_range, y_range, z_range = wall
                for x in (x_range if isinstance(x_range, range) else [x_range]):
                    for y in (y_range if isinstance(y_range, range) else [y_range]):
                        for z in (z_range if isinstance(z_range, range) else [z_range]):
                            if self._can_place(x, y, z, grid_w, grid_h, grid_d, occupancy_grid):
                                return x * grid_res, y * grid_res, z * grid_res
        
        elif strategy == 'gap_filling':
            # Look for gaps in already packed items
            # Scan for empty spaces that match item dimensions
            for z in range(grid_z_size - grid_d + 1):
                for y in range(grid_y_size - grid_h + 1):
                    for x in range(grid_x_size - grid_w + 1):
                        # Check if this is a "hole" (surrounded by occupied cells)
                        if self._is_gap_position(x, y, z, grid_w, grid_h, grid_d, occupancy_grid):
                            if self._can_place(x, y, z, grid_w, grid_h, grid_d, occupancy_grid):
                                return x * grid_res, y * grid_res, z * grid_res
        
        # Default: bottom-left-front
        for x in range(grid_x_size - grid_w + 1):
            for y in range(grid_y_size - grid_h + 1):
                for z in range(grid_z_size - grid_d + 1):
                    if self._can_place(x, y, z, grid_w, grid_h, grid_d, occupancy_grid):
                        return x * grid_res, y * grid_res, z * grid_res
        
        return None
    # def _can_place_item(self, x, y, z, w, h, d, occupied_spaces, tolerance=0.001):
    #  """Check if item can be placed without overlaps - FIXED with better precision"""
    # # Check container boundaries first
    #  if (x < -tolerance or x + w > self.container_width + tolerance or
    #     y < -tolerance or y + h > self.container_height + tolerance or
    #     z < -tolerance or z + d > self.container_depth + tolerance):
    #     return False
    
    # # Check for overlaps with other items
    #  for ox, oy, oz, ow, oh, od in occupied_spaces:
    #     # Check if boxes intersect with small tolerance
    #     if (x + w > ox + tolerance and
    #         ox + ow > x + tolerance and
    #         y + h > oy + tolerance and
    #         oy + oh > y + tolerance and
    #         z + d > oz + tolerance and
    #         oz + od > z + tolerance):
    #         return False
    
    #  return True
    def _can_place(self, grid_x, grid_y, grid_z, grid_w, grid_h, grid_d, occupancy_grid):
        """Check if space is available in grid"""
        grid_x_end = min(grid_x + grid_w, occupancy_grid.shape[0])
        grid_y_end = min(grid_y + grid_h, occupancy_grid.shape[1])
        grid_z_end = min(grid_z + grid_d, occupancy_grid.shape[2])
        
        # Ensure we have valid ranges
        if grid_x_end <= grid_x or grid_y_end <= grid_y or grid_z_end <= grid_z:
            return False
        
        # Check if all cells are empty
        return not np.any(occupancy_grid[grid_x:grid_x_end,
                                        grid_y:grid_y_end,
                                        grid_z:grid_z_end])
    
    def _is_gap_position(self, grid_x, grid_y, grid_z, grid_w, grid_h, grid_d, occupancy_grid):
        """Check if position is in a gap (surrounded by occupied cells)"""
        # Check if adjacent cells (except one side) are occupied
        # This helps fill holes in the packing
        if grid_x > 0:
            if not np.any(occupancy_grid[grid_x-1, grid_y:grid_y+grid_h, grid_z:grid_z+grid_d]):
                return False
        
        if grid_y > 0:
            if not np.any(occupancy_grid[grid_x:grid_x+grid_w, grid_y-1, grid_z:grid_z+grid_d]):
                return False
        
        if grid_z > 0:
            if not np.any(occupancy_grid[grid_x:grid_x+grid_w, grid_y:grid_y+grid_h, grid_z-1]):
                return False
        
        return True

# ====================================================================
# FIXED SAFE PACKER
# ====================================================================

class SafePacker:
    """Packer that never crashes - handles all exceptions"""
    
    def __init__(self):
        try:
            self.packer = Packer()
            self.validator = BoundaryValidator()
            self.advanced_algo = AdvancedPackingAlgorithm()
        except Exception as e:
            print(f"⚠️ SafePacker init warning: {e}")
            self.packer = None
    
    def pack_safely(self, bin_config, items_data):
        """Pack items with full error protection"""
        try:
            # Use our improved advanced algorithm
            return self._pack_with_advanced_algorithm(bin_config, items_data)
            
        except Exception as e:
            print(f"❌ Critical error in pack_safely: {e}")
            traceback.print_exc()
            return self._create_safe_fallback(bin_config, items_data)
    
    def _pack_with_advanced_algorithm(self, bin_config, items_data):
        """Pack using improved algorithm - FIXED"""
        try:
            container_dims = [
                SafeConverter.to_float(bin_config.width),
                SafeConverter.to_float(bin_config.height),
                SafeConverter.to_float(bin_config.depth)
            ]
            
            container_width, container_height, container_depth = container_dims
            
            print(f"📦 Container dimensions: {container_width}x{container_height}x{container_depth}")
            
            # Prepare items for packing
            packing_items = []
            for item_data in items_data:
                try:
                    width = SafeConverter.to_float(item_data.get('width', 0.5))
                    height = SafeConverter.to_float(item_data.get('height', 0.5))
                    depth = SafeConverter.to_float(item_data.get('depth', 0.5))
                    
                    # Calculate volume
                    volume = width * height * depth
                    
                    packing_items.append({
                        'id': SafeConverter.to_string(item_data.get('id')),
                        'dimensions': [width, height, depth],
                        'volume': volume,
                        'color': item_data.get('color', '#3B82F6'),
                        'original_name': item_data.get('original_name'),
                        'original_item': item_data
                    })
                except Exception as e:
                    print(f"⚠️ Failed to prepare item for packing: {e}")
                    continue
            
            print(f"📦 Preparing to pack {len(packing_items)} items")
            
            # Pack using advanced algorithm
            packed_data = self.advanced_algo.pack_items(container_dims, packing_items)
            
            # Convert to packed items
            packed_items = []
            packed_volume = 0.0
            
            for packed in packed_data:
                try:
                    # Get position and dimensions
                    position = packed['position']
                    dimensions = packed['dimensions']
                    rotation = packed['rotation']
                    original_item = packed['original_item']
                    
                    # Verify position is valid
                    if not self.validator.is_item_within_container(
                        position, dimensions, container_dims
                    ):
                        print(f"⚠️ Item {packed['id']} is out of bounds at {position}")
                        # Adjust position to fit
                        position = self.validator.get_safe_position(
                            position, container_dims, dimensions
                        )
                    
                    # Double-check for overlaps (safety)
                    overlaps = False
                    for other in packed_items:
                        other_pos = other.position
                        other_dims = other.dimensions
                        
                        # Check for intersection
                        if (position[0] < other_pos[0] + other_dims[0] and 
                            position[0] + dimensions[0] > other_pos[0] and
                            position[1] < other_pos[1] + other_dims[1] and 
                            position[1] + dimensions[1] > other_pos[1] and
                            position[2] < other_pos[2] + other_dims[2] and 
                            position[2] + dimensions[2] > other_pos[2]):
                            overlaps = True
                            print(f"⚠️ Overlap detected for item {packed['id']}")
                            break
                    
                    if not overlaps:
                        # Create packed item
                        packed_item = PackedItem(
                            id=packed['id'],
                            position=position,
                            rotation=rotation,
                            dimensions=dimensions,
                            color=original_item.get('color', '#3B82F6'),
                            original_name=original_item.get('original_name', packed['id'].split('_')[0]),
                            original_dimensions=dimensions,
                            rotation_mode_used='RotationMode.SMART',
                            bounding_box_volume=dimensions[0] * dimensions[1] * dimensions[2]
                        )
                        
                        packed_items.append(packed_item)
                        packed_volume += dimensions[0] * dimensions[1] * dimensions[2]
                        
                        print(f"✅ Successfully packed {packed['id']} at {position}")
                    
                except Exception as e:
                    print(f"⚠️ Failed to process packed item: {e}")
                    continue
            
            # Find unpacked items
            packed_ids = {item.id for item in packed_items}
            unpacked_items = []
            for item_data in items_data:
                try:
                    item_id = SafeConverter.to_string(item_data.get('id'))
                    if item_id not in packed_ids:
                        unpacked_items.append({
                            'id': item_id,
                            'original_name': item_data.get('original_name', item_id.split('_')[0]),
                            'dimensions': [
                                SafeConverter.to_float(item_data.get('width', 0.5)),
                                SafeConverter.to_float(item_data.get('height', 0.5)),
                                SafeConverter.to_float(item_data.get('depth', 0.5))
                            ],
                            'color': item_data.get('color', '#FF6B6B'),
                            'reason': 'No space available',
                            'volume': item_data.get('volume', 0.125),
                            'weight': item_data.get('weight', 0.0)
                        })
                except Exception as e:
                    print(f"⚠️ Failed to process unpacked item: {e}")
                    continue
            
            print(f"📊 Summary: Packed {len(packed_items)} items, {len(unpacked_items)} unpacked")
            
            # Calculate statistics
            container_volume = container_width * container_height * container_depth
            space_utilization = (packed_volume / container_volume * 100) if container_volume > 0 else 0
            
            # Calculate efficiency metrics
            total_items = len(items_data)
            packed_count = len(packed_items)
            packing_efficiency = (packed_count / total_items * 100) if total_items > 0 else 0
            
            print(f"📊 Utilization: {space_utilization:.1f}%")
            print(f"📊 Efficiency: {packing_efficiency:.1f}% ({packed_count}/{total_items})")
            
            # Create packed bin
            packed_bin = PackedBin(
                bin_id='bin_1',
                dimensions=[
                    float(container_width),
                    float(container_height),
                    float(container_depth)
                ],
                items=packed_items,
                utilization=round(space_utilization, 2),
                weight_utilization=None
            )
            
            return {
                'bins': [packed_bin],
                'unpacked_items': unpacked_items,
                'statistics': {
                    'success': True,
                    'space_utilization': round(space_utilization, 2),
                    'packing_efficiency': round(packing_efficiency, 2),
                    'container_volume': round(container_volume, 2),
                    'total_item_volume': sum(item.get('volume', 0) for item in items_data),
                    'packed_volume': round(packed_volume, 2),
                    'empty_volume': round(container_volume - packed_volume, 2),
                    'total_item_weight': 0,
                    'packed_weight': 0,
                    'bins_used': 1,
                    'items_packed': packed_count,
                    'total_items': total_items,
                    'strategy_used': 'advanced_algorithm_v2',
                    'solution_valid': True,
                    'validation_warnings': [],
                    'algorithm': 'maximal-rectangles'
                }
            }
            
        except Exception as e:
            print(f"❌ Error in advanced algorithm packing: {e}")
            traceback.print_exc()
            return self._create_safe_fallback(bin_config, items_data)
    
    def _create_safe_fallback(self, bin_config, items_data):
        """Create a safe fallback result - IMPROVED"""
        try:
            packed_items = []
            packed_volume = 0.0
            
            container_width = SafeConverter.to_float(bin_config.width, 10.0)
            container_height = SafeConverter.to_float(bin_config.height, 8.0)
            container_depth = SafeConverter.to_float(bin_config.depth, 10.0)
            
            print(f"🔄 Using improved fallback algorithm")
            
            # Sort by volume (largest first)
            sorted_items = sorted(
                items_data, 
                key=lambda x: SafeConverter.to_float(x.get('volume', 0)),
                reverse=True
            )
            
            # Track occupied spaces
            occupied_spaces = []  # List of (x, y, z, w, h, d)
            
            # Simple 3D grid placement
            for item_data in sorted_items:
                try:
                    item_id = SafeConverter.to_string(item_data.get('id', f'item_{len(packed_items)}'))
                    width = SafeConverter.to_float(item_data.get('width', 0.5))
                    height = SafeConverter.to_float(item_data.get('height', 0.5))
                    depth = SafeConverter.to_float(item_data.get('depth', 0.5))
                    color = item_data.get('color', '#3B82F6')
                    
                    # Skip invalid dimensions
                    if width <= 0 or height <= 0 or depth <= 0:
                        continue
                    
                    # Try to find a position
                    position_found = False
                    best_position = [0.0, 0.0, 0.0]
                    
                    # Try from bottom up, left to right, front to back
                    grid_step = min(width, height, depth) * 0.5
                    if grid_step < 0.1:
                        grid_step = 0.1
                    
                    for z in np.arange(0, container_depth - depth + grid_step, grid_step):
                        for y in np.arange(0, container_height - height + grid_step, grid_step):
                            for x in np.arange(0, container_width - width + grid_step, grid_step):
                                # Check for overlaps
                                overlaps = False
                                for ox, oy, oz, ow, oh, od in occupied_spaces:
                                    if (x < ox + ow and x + width > ox and
                                        y < oy + oh and y + height > oy and
                                        z < oz + od and z + depth > oz):
                                        overlaps = True
                                        break
                                
                                if not overlaps:
                                    best_position = [float(x), float(y), float(z)]
                                    position_found = True
                                    break
                            if position_found:
                                break
                        if position_found:
                            break
                    
                    if position_found:
                        packed_item = PackedItem(
                            id=item_id,
                            position=best_position,
                            rotation=[0, 0, 0],
                            dimensions=[width, height, depth],
                            color=color,
                            original_name=item_data.get('original_name', item_id.split('_')[0]),
                            original_dimensions=[width, height, depth],
                            rotation_mode_used='RotationMode.SMART',
                            bounding_box_volume=width * height * depth
                        )
                        
                        packed_items.append(packed_item)
                        packed_volume += width * height * depth
                        occupied_spaces.append((
                            best_position[0], best_position[1], best_position[2],
                            width, height, depth
                        ))
                        
                        print(f"✅ Fallback packed {item_id} at {best_position}")
                    
                except Exception as e:
                    print(f"⚠️ Fallback failed for item: {e}")
                    continue
            
            # Calculate statistics
            container_volume = container_width * container_height * container_depth
            space_utilization = (packed_volume / container_volume * 100) if container_volume > 0 else 0
            total_items = len(items_data)
            packed_count = len(packed_items)
            packing_efficiency = (packed_count / total_items * 100) if total_items > 0 else 0
            
            print(f"📊 Fallback packed {packed_count}/{total_items} items")
            print(f"📊 Fallback utilization: {space_utilization:.1f}%")
            
            # Create unpacked items list
            packed_ids = {item.id for item in packed_items}
            unpacked_items = []
            for item_data in items_data:
                try:
                    item_id = SafeConverter.to_string(item_data.get('id'))
                    if item_id not in packed_ids:
                        unpacked_items.append({
                            'id': item_id,
                            'original_name': item_data.get('original_name', item_id.split('_')[0]),
                            'dimensions': [
                                SafeConverter.to_float(item_data.get('width', 0.5)),
                                SafeConverter.to_float(item_data.get('height', 0.5)),
                                SafeConverter.to_float(item_data.get('depth', 0.5))
                            ],
                            'color': item_data.get('color', '#FF6B6B'),
                            'reason': 'No space available in fallback packing',
                            'volume': item_data.get('volume', 0.125),
                            'weight': item_data.get('weight', 0.0)
                        })
                except Exception as e:
                    print(f"⚠️ Failed to create unpacked item in fallback: {e}")
                    continue
            
            # Create packed bin
            packed_bin = PackedBin(
                bin_id='bin_1',
                dimensions=[container_width, container_height, container_depth],
                items=packed_items,
                utilization=round(space_utilization, 2),
                weight_utilization=None
            )
            
            return {
                'bins': [packed_bin],
                'unpacked_items': unpacked_items,
                'statistics': {
                    'success': True,
                    'space_utilization': round(space_utilization, 2),
                    'packing_efficiency': round(packing_efficiency, 2),
                    'container_volume': round(container_volume, 2),
                    'total_item_volume': sum(item.get('volume', 0) for item in items_data),
                    'packed_volume': round(packed_volume, 2),
                    'empty_volume': round(container_volume - packed_volume, 2),
                    'total_item_weight': 0,
                    'packed_weight': 0,
                    'bins_used': 1,
                    'items_packed': packed_count,
                    'total_items': total_items,
                    'strategy_used': 'fallback_v2',
                    'solution_valid': True,
                    'validation_warnings': ['Using improved fallback algorithm'],
                    'algorithm': 'maximal-rectangles'
                }
            }
            
        except Exception as e:
            print(f"❌ Critical error in fallback: {e}")
            return self._create_empty_result(bin_config, items_data)
    
    def _create_empty_result(self, bin_config, items_data):
        """Create an empty result when everything fails"""
        try:
            container_width = SafeConverter.to_float(bin_config.width, 10.0)
            container_height = SafeConverter.to_float(bin_config.height, 8.0)
            container_depth = SafeConverter.to_float(bin_config.depth, 10.0)
            
            # Create unpacked items from all items
            unpacked_items = []
            for item_data in items_data:
                try:
                    item_id = SafeConverter.to_string(item_data.get('id', 'unknown'))
                    unpacked_items.append({
                        'id': item_id,
                        'original_name': item_data.get('original_name', item_id.split('_')[0]),
                        'dimensions': [
                            SafeConverter.to_float(item_data.get('width', 0.5)),
                            SafeConverter.to_float(item_data.get('height', 0.5)),
                            SafeConverter.to_float(item_data.get('depth', 0.5))
                        ],
                        'color': item_data.get('color', '#FF6B6B'),
                        'reason': 'Packing failed completely',
                        'volume': item_data.get('volume', 0.125),
                        'weight': item_data.get('weight', 0.0)
                    })
                except Exception as e:
                    print(f"⚠️ Failed to create empty unpacked item: {e}")
                    continue
            
            return {
                'bins': [],
                'unpacked_items': unpacked_items,
                'statistics': {
                    'success': False,
                    'space_utilization': 0.0,
                    'packing_efficiency': 0.0,
                    'container_volume': container_width * container_height * container_depth,
                    'total_item_volume': sum(item.get('volume', 0) for item in items_data),
                    'packed_volume': 0.0,
                    'empty_volume': container_width * container_height * container_depth,
                    'total_item_weight': 0,
                    'packed_weight': 0,
                    'bins_used': 0,
                    'items_packed': 0,
                    'total_items': len(items_data),
                    'strategy_used': 'empty_fallback',
                    'solution_valid': False,
                    'validation_warnings': ['Packing failed completely'],
                    'algorithm': 'maximal-rectangles'
                }
            }
        except Exception as e:
            print(f"❌ Critical error in empty result: {e}")
            # Absolute last resort
            return {
                'bins': [],
                'unpacked_items': [],
                'statistics': {
                    'success': False,
                    'error': 'Critical packing failure',
                    'space_utilization': 0.0,
                    'packing_efficiency': 0.0,
                    'container_volume': 1000.0,
                    'total_item_volume': 0.0,
                    'packed_volume': 0.0,
                    'empty_volume': 1000.0,
                    'total_item_weight': 0,
                    'packed_weight': 0,
                    'bins_used': 0,
                    'items_packed': 0,
                    'total_items': 0,
                    'strategy_used': 'emergency_fallback',
                    'solution_valid': False,
                    'validation_warnings': ['Emergency fallback used'],
                    'algorithm': 'maximal-rectangles'
                }
            }

# ====================================================================
# MAIN PACKING SERVICE - FIXED
# ====================================================================

class UltraRobustPackingService:
    """Packing service that NEVER crashes - handles EVERY possible error"""
    
    def __init__(self):
        self.safe_packer = SafePacker()
    
    def calculate_packing(self, request: PackingRequest) -> PackingResult:
        """Main packing calculation - ABSOLUTELY NO EXCEPTIONS"""
        start_time = time.time()
        job_id = uuid.uuid4()
        
        try:
            print(f"🚀 Starting packing calculation for job {job_id}")
            print(f"📦 Algorithm requested: {request.algorithm}")
            
            # Prepare items data safely
            items_data = self._prepare_items_data_safely(request.items)
            if not items_data:
                print("⚠️ No valid items to pack")
                return self._create_no_items_result(job_id, request.bin_config, start_time)
            
            print(f"📦 Total valid items: {len(items_data)}")
            
            # Pack safely using improved algorithm
            packing_result = self.safe_packer.pack_safely(request.bin_config, items_data)
            
            # Add timing and algorithm info
            execution_time = time.time() - start_time
            packing_result['statistics']['execution_time_ms'] = round(execution_time * 1000, 2)
            packing_result['statistics']['algorithm'] = request.algorithm
            packing_result['statistics']['unpacked_items_count'] = len(packing_result.get('unpacked_items', []))
            
            # Add rotation stats
            packing_result['statistics'].setdefault('rotation_stats', {
                'items_with_rotation': 0,
                'max_rotation_angle': 0,
                'avg_rotation_angle': 0,
                'min_rotation_angle': 0,
                'rotation_modes_used': {},
                'rotation_efficiency_gain': 0.0,
                'rotation_attempts': 0
            })
            packing_result['statistics'].setdefault('rotation_mode', 'smart')
            
            # Build visualization data safely
            visualization_data_dict = self._build_visualization_data_safely(
                packing_result['bins'], 
                request.bin_config,
                packing_result.get('unpacked_items', []),
                items_data
            )
            
            # Build unpacked items safely
            unpacked_items = self._build_unpacked_items_safely(
                packing_result.get('unpacked_items', []),
                items_data
            )
            
            print(f"✅ Packing completed successfully for job {job_id}")
            
            return PackingResult(
                bins=packing_result['bins'],
                statistics=packing_result['statistics'],
                job_id=job_id,
                visualization_data=visualization_data_dict,
                unpacked_items=unpacked_items
            )
            
        except Exception as e:
            print(f"❌❌❌ UNEXPECTED ERROR in calculate_packing: {e}")
            traceback.print_exc()
            return self._create_emergency_result(job_id, e, start_time)
    
    def _prepare_items_data_safely(self, items: List[ItemSchema]) -> List[Dict]:
        """Prepare items data safely - no exceptions"""
        items_data = []
        item_counter = {}
        
        try:
            if not items:
                return []
            
            for item_schema in items:
                try:
                    base_name = SafeConverter.to_string(item_schema.name or item_schema.id, "item")
                    
                    quantity = SafeConverter.to_int(getattr(item_schema, 'quantity', 1))
                    if quantity < 1:
                        quantity = 1
                    
                    for i in range(quantity):
                        item_counter[base_name] = item_counter.get(base_name, 0) + 1
                        item_id = f"{base_name}_{item_counter[base_name]}"
                        
                        # Convert dimensions safely
                        width = SafeConverter.to_float(item_schema.width, 0.5)
                        height = SafeConverter.to_float(item_schema.height, 0.5)
                        depth = SafeConverter.to_float(item_schema.depth, 0.5)
                        
                        # Skip invalid dimensions
                        if width <= 0 or height <= 0 or depth <= 0:
                            print(f"⚠️ Skipping item {item_id} with invalid dimensions")
                            continue
                        
                        # Calculate volume
                        volume = width * height * depth
                        
                        # Get color safely
                        color = getattr(item_schema, 'color', None)
                        if not color or not isinstance(color, str) or not color.startswith('#'):
                            color = self._generate_color_safely(base_name)
                        
                        items_data.append({
                            'id': item_id,
                            'original_name': base_name,
                            'width': width,
                            'height': height,
                            'depth': depth,
                            'volume': volume,
                            'color': color,
                            'weight': SafeConverter.to_float(getattr(item_schema, 'weight', 0.0))
                        })
                
                except Exception as e:
                    print(f"⚠️ Failed to prepare item: {e}")
                    continue
            
            print(f"📦 Prepared {len(items_data)} valid items for packing")
            return items_data
            
        except Exception as e:
            print(f"❌ Error in prepare_items_data_safely: {e}")
            return []
    
    def _build_visualization_data_safely(self, packed_bins, bin_config, unpacked_items_data, original_items_data):
        """Build visualization data safely - no exceptions"""
        try:
            items_data = []
            
            # Process packed items
            for bin_idx, packed_bin in enumerate(packed_bins):
                try:
                    for item in getattr(packed_bin, 'items', []):
                        try:
                            items_data.append({
                                "id": SafeConverter.to_string(getattr(item, 'id', f'item_{len(items_data)}')),
                                "position": SafeConverter.to_number_list(getattr(item, 'position', [0, 0, 0])),
                                "rotation": SafeConverter.to_number_list(getattr(item, 'rotation', [0, 0, 0])),
                                "dimensions": SafeConverter.to_number_list(getattr(item, 'dimensions', [0.5, 0.5, 0.5])),
                                "color": SafeConverter.to_string(getattr(item, 'color', '#3B82F6')),
                                "bin_index": bin_idx,
                                "original_name": SafeConverter.to_string(getattr(item, 'original_name', 'Unknown'))
                            })
                        except Exception as e:
                            print(f"⚠️ Failed to process packed item for visualization: {e}")
                            continue
                except Exception as e:
                    print(f"⚠️ Failed to process bin for visualization: {e}")
                    continue
            
            # Process unpacked items
            unpacked_items_for_viz = []
            for unpacked_item in unpacked_items_data:
                try:
                    unpacked_items_for_viz.append({
                        "name": SafeConverter.to_string(unpacked_item.get('original_name', 'Unknown')),
                        "id": SafeConverter.to_string(unpacked_item.get('id', str(uuid.uuid4()))),
                        "dimensions": SafeConverter.to_number_list(unpacked_item.get('dimensions', [0.5, 0.5, 0.5])),
                        "volume": SafeConverter.to_float(unpacked_item.get('volume', 0.125)),
                        "color": SafeConverter.to_string(unpacked_item.get('color', '#FF6B6B')),
                        "reason": SafeConverter.to_string(unpacked_item.get('reason', 'No space available')),
                        "weight": SafeConverter.to_float(unpacked_item.get('weight', 0.0)),
                        "quantity": 1,
                        "rotation_attempts": SafeConverter.to_int(unpacked_item.get('rotation_attempts', 0))
                    })
                except Exception as e:
                    print(f"⚠️ Failed to process unpacked item for visualization: {e}")
                    continue
            
            # Build container info
            try:
                container_width = SafeConverter.to_float(bin_config.width, 10.0)
                container_height = SafeConverter.to_float(bin_config.height, 8.0)
                container_depth = SafeConverter.to_float(bin_config.depth, 10.0)
                
                # Calculate packed volume for summary
                packed_volume = 0.0
                for item in items_data:
                    dims = item.get('dimensions', [0.5, 0.5, 0.5])
                    if len(dims) == 3:
                        packed_volume += dims[0] * dims[1] * dims[2]
                
                container_volume = container_width * container_height * container_depth
                space_utilization = (packed_volume / container_volume * 100) if container_volume > 0 else 0
                
                visualization_data_dict = {
                    "items": items_data,
                    "unpacked_items": unpacked_items_for_viz,
                    "container": {
                        "width": container_width,
                        "height": container_height,
                        "depth": container_depth,
                        "volume": container_volume
                    },
                    "scene": {
                        "background": "#f8fafc",
                        "grid": True,
                        "axes": True,
                        "camera": {
                            "position": [20, 15, 20],
                            "target": [0, 0, 0]
                        }
                    },
                    "summary": {
                        "total_items": len(original_items_data),
                        "packed_items": len(items_data),
                        "unpacked_count": len(unpacked_items_data),
                        "space_utilization": round(space_utilization, 2),
                        "efficiency": round((len(items_data) / len(original_items_data) * 100) if original_items_data else 0, 2)
                    }
                }
            except Exception as e:
                print(f"⚠️ Failed to build container info: {e}")
                visualization_data_dict = {
                    "items": items_data,
                    "unpacked_items": unpacked_items_for_viz,
                    "container": {"width": 10.0, "height": 8.0, "depth": 10.0, "volume": 800.0},
                    "scene": {
                        "background": "#f8fafc",
                        "grid": True,
                        "axes": True,
                        "camera": {"position": [20, 15, 20], "target": [0, 0, 0]}
                    },
                    "summary": {
                        "total_items": len(original_items_data) if original_items_data else 0,
                        "packed_items": len(items_data),
                        "unpacked_count": len(unpacked_items_data) if unpacked_items_data else 0,
                        "space_utilization": 0.0,
                        "efficiency": 0.0
                    }
                }
            
            return visualization_data_dict
            
        except Exception as e:
            print(f"❌ Error in build_visualization_data_safely: {e}")
            # Return minimal valid visualization data
            return {
                "items": [],
                "unpacked_items": [],
                "container": {"width": 10.0, "height": 8.0, "depth": 10.0, "volume": 800.0},
                "scene": {
                    "background": "#f8fafc",
                    "grid": True,
                    "axes": True,
                    "camera": {"position": [20, 15, 20], "target": [0, 0, 0]}
                },
                "summary": {
                    "total_items": len(original_items_data) if original_items_data else 0,
                    "packed_items": 0,
                    "unpacked_count": len(unpacked_items_data) if unpacked_items_data else 0,
                    "space_utilization": 0.0,
                    "efficiency": 0.0
                }
            }
    
    def _build_unpacked_items_safely(self, unpacked_items_data, original_items_data):
        """Build unpacked items list safely"""
        unpacked_items = []
        
        try:
            for item_data in unpacked_items_data:
                try:
                    item = UnpackedItem(
                        name=SafeConverter.to_string(item_data.get('original_name', 'Unknown')),
                        id=SafeConverter.to_string(item_data.get('id', str(uuid.uuid4()))),
                        dimensions=SafeConverter.to_number_list(item_data.get('dimensions', [0.5, 0.5, 0.5])),
                        volume=SafeConverter.to_float(item_data.get('volume', 0.125)),
                        color=SafeConverter.to_string(item_data.get('color', '#FF6B6B')),
                        reason=SafeConverter.to_string(item_data.get('reason', 'No space available')),
                        weight=SafeConverter.to_float(item_data.get('weight', 0.0)),
                        quantity=1,
                        rotation_attempts=SafeConverter.to_int(item_data.get('rotation_attempts', 0))
                    )
                    unpacked_items.append(item)
                except Exception as e:
                    print(f"⚠️ Failed to build unpacked item: {e}")
                    continue
            
            return unpacked_items
            
        except Exception as e:
            print(f"❌ Error in build_unpacked_items_safely: {e}")
            return []
    
    def _create_no_items_result(self, job_id, bin_config, start_time):
        """Create result when no valid items to pack"""
        execution_time = time.time() - start_time
        
        try:
            container_width = SafeConverter.to_float(bin_config.width, 10.0)
            container_height = SafeConverter.to_float(bin_config.height, 8.0)
            container_depth = SafeConverter.to_float(bin_config.depth, 10.0)
            container_volume = container_width * container_height * container_depth
        except Exception:
            container_volume = 800.0
            container_width = 10.0
            container_height = 8.0
            container_depth = 10.0
        
        visualization_data = {
            "items": [],
            "unpacked_items": [],
            "container": {
                "width": container_width,
                "height": container_height,
                "depth": container_depth,
                "volume": container_volume
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
                "total_items": 0,
                "packed_items": 0,
                "unpacked_count": 0,
                "space_utilization": 0.0,
                "efficiency": 0.0
            }
        }
        
        statistics = {
            "success": False,
            "error": "No valid items to pack",
            "space_utilization": 0.0,
            "packing_efficiency": 0.0,
            "container_volume": container_volume,
            "total_item_volume": 0.0,
            "packed_volume": 0.0,
            "empty_volume": container_volume,
            "total_item_weight": 0,
            "packed_weight": 0,
            "bins_used": 0,
            "items_packed": 0,
            "total_items": 0,
            "unpacked_items_count": 0,
            "execution_time_ms": round(execution_time * 1000, 2),
            "algorithm": "none",
            "validation_warnings": ["No valid items provided"],
            "strategy_used": "none",
            "solution_valid": False,
            "rotation_mode": "none",
            "rotation_stats": {
                'items_with_rotation': 0,
                'max_rotation_angle': 0,
                'avg_rotation_angle': 0,
                'min_rotation_angle': 0,
                'rotation_modes_used': {},
                'rotation_efficiency_gain': 0.0,
                'rotation_attempts': 0
            }
        }
        
        return PackingResult(
            bins=[],
            statistics=statistics,
            job_id=job_id,
            visualization_data=visualization_data,
            unpacked_items=[]
        )
    
    def _create_emergency_result(self, job_id, error, start_time):
        """Create emergency result when everything fails"""
        execution_time = time.time() - start_time
        
        visualization_data = {
            "items": [],
            "unpacked_items": [],
            "container": {"width": 0.0, "height": 0.0, "depth": 0.0, "volume": 0.0},
            "scene": {
                "background": "#f8fafc",
                "grid": False,
                "axes": False,
                "camera": {"position": [0, 0, 0], "target": [0, 0, 0]}
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
            "success": False,
            "error": f"Critical error: {str(error)[:100]}",
            "space_utilization": 0.0,
            "packing_efficiency": 0.0,
            "container_volume": 0.0,
            "total_item_volume": 0.0,
            "packed_volume": 0.0,
            "empty_volume": 0.0,
            "total_item_weight": 0,
            "packed_weight": 0,
            "bins_used": 0,
            "items_packed": 0,
            "total_items": 0,
            "unpacked_items_count": 0,
            "execution_time_ms": round(execution_time * 1000, 2),
            "algorithm": "emergency",
            "validation_warnings": ["Critical system error occurred"],
            "strategy_used": "emergency_fallback",
            "solution_valid": False,
            "rotation_mode": "none",
            "rotation_stats": {
                'items_with_rotation': 0,
                'max_rotation_angle': 0,
                'avg_rotation_angle': 0,
                'min_rotation_angle': 0,
                'rotation_modes_used': {},
                'rotation_efficiency_gain': 0.0,
                'rotation_attempts': 0
            }
        }
        
        return PackingResult(
            bins=[],
            statistics=statistics,
            job_id=job_id,
            visualization_data=visualization_data,
            unpacked_items=[]
        )
    
    def _generate_color_safely(self, base_name):
        """Generate a consistent color based on item name"""
        try:
            hash_val = hash(base_name) % 360
            hue = abs(hash_val) % 360
            return f'hsl({hue}, 70%, 50%)'
        except Exception:
            return '#3B82F6'  # Default blue

# Create singleton instance
packing_service = UltraRobustPackingService()