import PropTypes from 'prop-types';

// Dimension types
export const Vector3D = PropTypes.arrayOf(PropTypes.number);
export const Dimensions3D = PropTypes.shape({
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
});

// Bin/Container types
export const BinConfig = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  dimensions: Dimensions3D.isRequired,
  maxWeight: PropTypes.number,
  quantity: PropTypes.number,
  color: PropTypes.string,
  isOpenTop: PropTypes.bool,
});

// Item types
export const PackingItem = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  dimensions: Dimensions3D.isRequired,
  weight: PropTypes.number,
  quantity: PropTypes.number.isRequired,
  canRotate: PropTypes.bool,
  color: PropTypes.string,
  priority: PropTypes.oneOf([1, 2, 3]),
  fragile: PropTypes.bool,
  stackable: PropTypes.bool,
});

// Visualization types
export const VisualItem = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  dimensions: Vector3D.isRequired,
  position: Vector3D.isRequired,
  rotation: Vector3D,
  color: PropTypes.string,
});

export const VisualBin = PropTypes.shape({
  id: PropTypes.string.isRequired,
  dimensions: Vector3D.isRequired,
  position: Vector3D,
  items: PropTypes.arrayOf(VisualItem),
  utilization: PropTypes.number,
  color: PropTypes.string,
});

// Result types
export const PackingResult = PropTypes.shape({
  jobId: PropTypes.string,
  efficiency: PropTypes.number,
  binsUsed: PropTypes.number,
  visualization: PropTypes.shape({
    bins: PropTypes.arrayOf(VisualBin),
    scene: PropTypes.object,
    camera: PropTypes.object,
    lights: PropTypes.array,
    materials: PropTypes.array,
  }),
  statistics: PropTypes.shape({
    efficiency: PropTypes.number,
    binsUsed: PropTypes.number,
    totalItems: PropTypes.number,
    spaceUtilized: PropTypes.number,
    wastedSpace: PropTypes.number,
    algorithm: PropTypes.string,
  }),
  instructions: PropTypes.arrayOf(PropTypes.string),
  timestamp: PropTypes.string,
});

// Form types
export const InputField = PropTypes.shape({
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['number', 'text', 'select', 'checkbox', 'range']),
  min: PropTypes.number,
  max: PropTypes.number,
  step: PropTypes.number,
  defaultValue: PropTypes.any,
  required: PropTypes.bool,
  unit: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string,
    label: PropTypes.string,
  })),
});

// Default values
export const defaultBinConfig = {
  id: 'bin-1',
  name: 'Main Container',
  dimensions: { width: 100, height: 80, depth: 60 },
  maxWeight: 500,
  quantity: 1,
  color: '#3498db',
  isOpenTop: false,
};

export const defaultPackingItem = {
  id: '',
  name: 'New Item',
  dimensions: { width: 10, height: 10, depth: 10 },
  weight: 0,
  quantity: 1,
  canRotate: true,
  color: '#e74c3c',
  priority: 2,
  fragile: false,
  stackable: true,
};

// Export all
export default {
  Vector3D,
  Dimensions3D,
  BinConfig,
  PackingItem,
  VisualItem,
  VisualBin,
  PackingResult,
  InputField,
  defaultBinConfig,
  defaultPackingItem,
};