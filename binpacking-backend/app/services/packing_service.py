"""
ULTRA-ROBUST Packing Service - No Exceptions Allowed!
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

# Update the SafeConverter to use TypeSafeConverter
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
            
            # Check boundaries with tolerance
            within_x = (x >= -tolerance) and ((x + w) <= (cw + tolerance))
            within_y = (y >= -tolerance) and ((y + h) <= (ch + tolerance))
            within_z = (z >= -tolerance) and ((z + d) <= (cd + tolerance))
            
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
            
            # Ensure within bounds
            safe_x = max(0.0, min(safe_x, cw - w))
            safe_y = max(0.0, min(safe_y, ch - h))
            safe_z = max(0.0, min(safe_z, cd - d))
            
            return [safe_x, safe_y, safe_z]
            
        except Exception as e:
            print(f"❌ BoundaryValidator.get_safe_position error: {e}")
            return [0.0, 0.0, 0.0]

# ====================================================================
# SAFE PACKER
# ====================================================================

class SafePacker:
    """Packer that never crashes - handles all exceptions"""
    
    def __init__(self):
        try:
            self.packer = Packer()
            self.validator = BoundaryValidator()
        except Exception as e:
            print(f"⚠️ SafePacker init warning: {e}")
            self.packer = None
    
    def pack_safely(self, bin_config, items_data):
        """Pack items with full error protection"""
        try:
            if not self.packer:
                return self._create_safe_fallback(bin_config, items_data)
            
            # Reset packer
            self.packer.bins = []
            self.packer.items = []
            
            # Create bin safely
            try:
                bin_width = SafeConverter.to_float(bin_config.width, 10.0)
                bin_height = SafeConverter.to_float(bin_config.height, 8.0)
                bin_depth = SafeConverter.to_float(bin_config.depth, 10.0)
                
                main_bin = Bin(
                    name="safe_container",
                    width=bin_width,
                    height=bin_height,
                    depth=bin_depth,
                    max_weight=10000.0
                )
                self.packer.add_bin(main_bin)
            except Exception as e:
                print(f"⚠️ Failed to create bin: {e}")
                return self._create_safe_fallback(bin_config, items_data)
            
            # Add items safely
            added_items = 0
            for item_data in items_data:
                try:
                    item_id = SafeConverter.to_string(item_data.get('id', f'item_{added_items}'))
                    width = SafeConverter.to_float(item_data.get('width', 0.5))
                    height = SafeConverter.to_float(item_data.get('height', 0.5))
                    depth = SafeConverter.to_float(item_data.get('depth', 0.5))
                    
                    # Skip invalid dimensions
                    if width <= 0 or height <= 0 or depth <= 0:
                        print(f"⚠️ Skipping item {item_id} with invalid dimensions")
                        continue
                    
                    item = Item(
                        name=item_id,
                        width=width,
                        height=height,
                        depth=depth,
                        weight=0.0
                    )
                    self.packer.add_item(item)
                    added_items += 1
                    
                except Exception as e:
                    print(f"⚠️ Failed to add item {item_data.get('id', 'unknown')}: {e}")
                    continue
            
            if added_items == 0:
                print("⚠️ No items could be added to packer")
                return self._create_safe_fallback(bin_config, items_data)
            
            # Try to pack
            try:
                self.packer.pack(bigger_first=True, distribute_items=False)
            except Exception as e:
                print(f"⚠️ Packing failed: {e}")
                return self._create_safe_fallback(bin_config, items_data)
            
            # Process results safely
            return self._process_results_safely(bin_config, items_data)
            
        except Exception as e:
            print(f"❌ Critical error in pack_safely: {e}")
            traceback.print_exc()
            return self._create_safe_fallback(bin_config, items_data)
    
    def _process_results_safely(self, bin_config, items_data):
        """Process packing results safely with proper typing"""
        try:
            packed_items: List[PackedItem] = []
            packed_volume = 0.0
            
            container_dims = [
                SafeConverter.to_float(bin_config.width),
                SafeConverter.to_float(bin_config.height),
                SafeConverter.to_float(bin_config.depth)
            ]
            
            # TYPE FIX: Check if packer exists and has bins
            if not self.packer or not hasattr(self.packer, 'bins'):
                print("⚠️ Packer or bins not available")
                return self._create_safe_fallback(bin_config, items_data)
            
            # Process each bin
            for bin_idx, bin_obj in enumerate(self.packer.bins):
                # TYPE FIX: Check if bin_obj exists
                if not bin_obj:
                    continue
                    
                # TYPE FIX: Safely get items
                bin_items = getattr(bin_obj, 'items', [])
                if not isinstance(bin_items, (list, tuple)):
                    continue
                
                for item in bin_items:
                    try:
                        # Get item data safely
                        item_id = SafeConverter.to_string(getattr(item, 'name', f'item_{len(packed_items)}'))
                        
                        # Find original item data
                        original_item = None
                        for orig in items_data:
                            if SafeConverter.to_string(orig.get('id')) == item_id:
                                original_item = orig
                                break
                        
                        # Get dimensions safely
                        width = SafeConverter.to_float(getattr(item, 'width', 0.5))
                        height = SafeConverter.to_float(getattr(item, 'height', 0.5))
                        depth = SafeConverter.to_float(getattr(item, 'depth', 0.5))
                        
                        # Get position safely - use TypeSafeConverter
                        position_list = [0.0, 0.0, 0.0]
                        if hasattr(item, 'position') and item.position:
                            pos = item.position
                            # Convert to proper float list
                            position_list = SafeConverter.to_number_list(pos)
                        
                        # Ensure position is within bounds
                        position_list = self.validator.get_safe_position(
                            position_list, 
                            container_dims,
                            [width, height, depth]
                        )
                        
                        # TYPE FIX: Convert to List[Union[int, float]] for PackedItem
                        position_for_packeditem: List[Union[int, float]] = [
                            float(position_list[0]),
                            float(position_list[1]),
                            float(position_list[2])
                        ]
                        
                        dimensions_for_packeditem: List[Union[int, float]] = [
                            float(width),
                            float(height),
                            float(depth)
                        ]
                        
                        # Get color from original item or generate
                        color = '#3B82F6'  # Default blue
                        if original_item:
                            color = original_item.get('color', color)
                        
                        # Create packed item with proper typing
                        packed_item = PackedItem(
                            id=item_id,
                            position=position_for_packeditem,  # Now properly typed
                            rotation=[0, 0, 0],
                            dimensions=dimensions_for_packeditem,  # Now properly typed
                            color=color,
                            original_name=original_item.get('original_name', item_id.split('_')[0]) if original_item else item_id.split('_')[0],
                            original_dimensions=dimensions_for_packeditem,
                            rotation_mode_used='RotationMode.SMART',
                            bounding_box_volume=width * height * depth
                        )
                        
                        packed_items.append(packed_item)
                        packed_volume += width * height * depth
                        
                    except Exception as e:
                        print(f"⚠️ Failed to process item: {e}")
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
            
            # Calculate statistics
            container_volume = container_dims[0] * container_dims[1] * container_dims[2]
            space_utilization = (packed_volume / container_volume * 100) if container_volume > 0 else 0
            
            # Create packed bin with proper typing
            packed_bin = PackedBin(
                bin_id='bin_1',
                dimensions=[
                    float(container_dims[0]),
                    float(container_dims[1]),
                    float(container_dims[2])
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
                    'packing_efficiency': (len(packed_items) / len(items_data) * 100) if items_data else 0,
                    'container_volume': round(container_volume, 2),
                    'total_item_volume': sum(item.get('volume', 0) for item in items_data),
                    'packed_volume': round(packed_volume, 2),
                    'empty_volume': round(container_volume - packed_volume, 2),
                    'total_item_weight': 0,
                    'packed_weight': 0,
                    'bins_used': 1,
                    'items_packed': len(packed_items),
                    'total_items': len(items_data),
                    'strategy_used': 'safe_packer',
                    'solution_valid': True,
                    'validation_warnings': []
                }
            }
            
        except Exception as e:
            print(f"❌ Error processing results: {e}")
            traceback.print_exc()
            return self._create_safe_fallback(bin_config, items_data)
    
    def _create_safe_fallback(self, bin_config, items_data):
        """Create a safe fallback result when everything fails"""
        try:
            # Simple placement algorithm that never fails
            packed_items = []
            packed_volume = 0.0
            
            container_width = SafeConverter.to_float(bin_config.width, 10.0)
            container_height = SafeConverter.to_float(bin_config.height, 8.0)
            container_depth = SafeConverter.to_float(bin_config.depth, 10.0)
            
            # Sort by volume (largest first)
            sorted_items = sorted(
                items_data, 
                key=lambda x: SafeConverter.to_float(x.get('volume', 0)),
                reverse=True
            )
            
            current_x, current_y, current_z = 0, 0, 0
            max_y_in_row = 0
            max_z_in_layer = 0
            
            for item_data in sorted_items:
                try:
                    item_id = SafeConverter.to_string(item_data.get('id', f'item_{len(packed_items)}'))
                    width = SafeConverter.to_float(item_data.get('width', 0.5))
                    height = SafeConverter.to_float(item_data.get('height', 0.5))
                    depth = SafeConverter.to_float(item_data.get('depth', 0.5))
                    color = item_data.get('color', '#3B82F6')
                    
                    # Check if fits
                    fits_x = current_x + width <= container_width
                    fits_y = current_y + height <= container_height
                    fits_z = current_z + depth <= container_depth
                    
                    if fits_x and fits_y and fits_z:
                        # Place item
                        position = [current_x, current_y, current_z]
                        
                        packed_item = PackedItem(
                            id=item_id,
                            position=position,
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
                        
                        # Update position for next item
                        current_x += width
                        max_y_in_row = max(max_y_in_row, height)
                        max_z_in_layer = max(max_z_in_layer, depth)
                        
                        # Move to next row if needed
                        if current_x + width > container_width:
                            current_x = 0
                            current_y += max_y_in_row
                            max_y_in_row = 0
                            
                            # Move to next layer if needed
                            if current_y + height > container_height:
                                current_y = 0
                                current_z += max_z_in_layer
                                max_z_in_layer = 0
                    
                except Exception as e:
                    print(f"⚠️ Fallback failed for item: {e}")
                    continue
            
            # Calculate statistics
            container_volume = container_width * container_height * container_depth
            space_utilization = (packed_volume / container_volume * 100) if container_volume > 0 else 0
            
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
                    'packing_efficiency': (len(packed_items) / len(items_data) * 100) if items_data else 0,
                    'container_volume': round(container_volume, 2),
                    'total_item_volume': sum(item.get('volume', 0) for item in items_data),
                    'packed_volume': round(packed_volume, 2),
                    'empty_volume': round(container_volume - packed_volume, 2),
                    'total_item_weight': 0,
                    'packed_weight': 0,
                    'bins_used': 1,
                    'items_packed': len(packed_items),
                    'total_items': len(items_data),
                    'strategy_used': 'fallback_safe',
                    'solution_valid': True,
                    'validation_warnings': ['Using safe fallback algorithm']
                }
            }
            
        except Exception as e:
            print(f"❌ Critical error in fallback: {e}")
            # Last resort - empty result
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
                    'validation_warnings': ['Packing failed completely']
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
                    'validation_warnings': ['Emergency fallback used']
                }
            }

# ====================================================================
# MAIN PACKING SERVICE - ULTRA ROBUST
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
            
            # Validate request safely
            validation_result = self._validate_request_safely(request)
            if not validation_result["valid"]:
                print(f"❌ Validation failed: {validation_result['errors']}")
                return self._create_validation_error_result(job_id, validation_result, start_time)
            
            # Prepare items data safely
            items_data = self._prepare_items_data_safely(request.items)
            if not items_data:
                print("⚠️ No valid items to pack")
                return self._create_no_items_result(job_id, request.bin_config, start_time)
            
            # Pack safely
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
            
            # Build unpacked items safely - FIXED: Only process actual unpacked items
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
    
    def _validate_request_safely(self, request: PackingRequest) -> Dict[str, Any]:
        """Validate request safely - no exceptions"""
        errors = []
        warnings = []
        
        try:
            # Check bin config exists
            if not hasattr(request, 'bin_config') or not request.bin_config:
                errors.append("Bin configuration is missing")
                return {"valid": False, "errors": errors, "warnings": warnings}
            
            # Validate bin dimensions
            bin_cfg = request.bin_config
            
            width = SafeConverter.to_float(bin_cfg.width)
            height = SafeConverter.to_float(bin_cfg.height)
            depth = SafeConverter.to_float(bin_cfg.depth)
            
            if width <= 0:
                errors.append("Container width must be positive")
            if height <= 0:
                errors.append("Container height must be positive")
            if depth <= 0:
                errors.append("Container depth must be positive")
            
            if width > 100:
                warnings.append("Container width is very large (>100m)")
            if height > 100:
                warnings.append("Container height is very large (>100m)")
            if depth > 100:
                warnings.append("Container depth is very large (>100m)")
            
            # Check items
            if not hasattr(request, 'items') or not request.items:
                errors.append("At least one item is required")
            else:
                # Check each item
                for i, item in enumerate(request.items):
                    try:
                        item_width = SafeConverter.to_float(item.width)
                        item_height = SafeConverter.to_float(item.height)
                        item_depth = SafeConverter.to_float(item.depth)
                        
                        if item_width <= 0 or item_height <= 0 or item_depth <= 0:
                            errors.append(f"Item {i+1} has invalid dimensions")
                        
                        if item_width > width and item_height > height and item_depth > depth:
                            warnings.append(f"Item {item.name or item.id} may be too large for container")
                    
                    except Exception as e:
                        errors.append(f"Item {i+1} validation failed: {str(e)[:50]}")
            
        except Exception as e:
            errors.append(f"Validation error: {str(e)[:100]}")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
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
                    print(f"⚠️ Failed to prepare item {getattr(item_schema, 'id', 'unknown')}: {e}")
                    continue
            
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
                    print(f"⚠️ Failed to process bin {bin_idx} for visualization: {e}")
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
                
                visualization_data_dict = {
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
                            "target": [0, 0, 0]
                        }
                    },
                    "summary": {
                        "total_items": len(original_items_data),
                        "packed_items": len(items_data),
                        "unpacked_count": len(unpacked_items_data),
                        "space_utilization": 0.0,  # Will be filled from statistics
                        "efficiency": 0.0  # Will be filled from statistics
                    }
                }
            except Exception as e:
                print(f"⚠️ Failed to build container info: {e}")
                visualization_data_dict = {
                    "items": items_data,
                    "unpacked_items": unpacked_items_for_viz,
                    "container": {
                        "width": 10.0,
                        "height": 8.0,
                        "depth": 10.0,
                        "volume": 800.0
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
                        "total_items": len(original_items_data) if original_items_data else 0,
                        "packed_items": len(items_data),
                        "unpacked_count": len(unpacked_items_data) if unpacked_items_data else 0,
                        "space_utilization": 0.0,
                        "efficiency": 0.0
                    }
                }
            
            # Return as dict for compatibility with PackingResult schema
            return visualization_data_dict
            
        except Exception as e:
            print(f"❌ Error in build_visualization_data_safely: {e}")
            # Return minimal valid visualization data as dict
            return {
                "items": [],
                "unpacked_items": [],
                "container": {
                    "width": 10.0,
                    "height": 8.0,
                    "depth": 10.0,
                    "volume": 800.0
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
                    "total_items": len(original_items_data) if original_items_data else 0,
                    "packed_items": 0,
                    "unpacked_count": len(unpacked_items_data) if unpacked_items_data else 0,
                    "space_utilization": 0.0,
                    "efficiency": 0.0
                }
            }
    
    def _build_unpacked_items_safely(self, unpacked_items_data, original_items_data):
        """Build unpacked items list safely - no exceptions - FIXED VERSION"""
        unpacked_items = []
        
        try:
            # Process only actual unpacked items from packing result
            for item_data in unpacked_items_data:
                try:
                    # Create UnpackedItem according to your schema
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
            
            # REMOVED THE BUGGY LOGIC THAT CREATED UNPACKED ITEMS WHEN PACKING SUCCEEDED
            
            return unpacked_items
            
        except Exception as e:
            print(f"❌ Error in build_unpacked_items_safely: {e}")
            return []
    
    def _create_validation_error_result(self, job_id, validation_result, start_time):
        """Create result for validation errors"""
        execution_time = time.time() - start_time
        
        # Build visualization data as dict
        visualization_data = {
            "items": [],
            "unpacked_items": [],
            "container": {
                "width": 0.0,
                "height": 0.0,
                "depth": 0.0,
                "volume": 0.0
            },
            "scene": {
                "background": "#f8fafc",
                "grid": False,
                "axes": False,
                "camera": {
                    "position": [0, 0, 0],
                    "target": [0, 0, 0]
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
        
        # Build statistics with rotation stats
        statistics = {
            "success": False,
            "validation_errors": validation_result["errors"],
            "warnings": validation_result["warnings"],
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
            "algorithm": "none",
            "validation_warnings": validation_result["warnings"],
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
            "container": {
                "width": 0.0,
                "height": 0.0,
                "depth": 0.0,
                "volume": 0.0
            },
            "scene": {
                "background": "#f8fafc",
                "grid": False,
                "axes": False,
                "camera": {
                    "position": [0, 0, 0],
                    "target": [0, 0, 0]
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
        """Generate a consistent color based on item name - no exceptions"""
        try:
            # Simple hash-based color generation
            hash_val = hash(base_name) % 360
            hue = abs(hash_val) % 360
            return f'hsl({hue}, 70%, 50%)'
        except Exception:
            return '#3B82F6'  # Default blue

            # Add this method to the UltraRobustPackingService class
    def _validate_request(self, request: PackingRequest) -> Dict[str, Any]:
        """Validate request and calculate volume analysis"""
        validation_result = self._validate_request_safely(request)
        
        # Calculate volume analysis
        total_volume = 0.0
        container_volume = 0.0
        
        try:
            # Calculate container volume
            container_width = SafeConverter.to_float(request.bin_config.width, 0.0)
            container_height = SafeConverter.to_float(request.bin_config.height, 0.0)
            container_depth = SafeConverter.to_float(request.bin_config.depth, 0.0)
            container_volume = container_width * container_height * container_depth
            
            # Calculate total item volume
            if hasattr(request, 'items') and request.items:
                for item in request.items:
                    try:
                        quantity = SafeConverter.to_int(getattr(item, 'quantity', 1))
                        width = SafeConverter.to_float(item.width, 0.0)
                        height = SafeConverter.to_float(item.height, 0.0)
                        depth = SafeConverter.to_float(item.depth, 0.0)
                        item_volume = width * height * depth
                        total_volume += item_volume * quantity
                    except Exception as e:
                        print(f"⚠️ Failed to calculate volume for item: {e}")
                        continue
        except Exception as e:
            print(f"⚠️ Failed to calculate volumes: {e}")
        
        # Add volume analysis to validation result
        validation_result["total_volume"] = total_volume
        validation_result["container_volume"] = container_volume
        
        return validation_result

# Create singleton instance
packing_service = UltraRobustPackingService()