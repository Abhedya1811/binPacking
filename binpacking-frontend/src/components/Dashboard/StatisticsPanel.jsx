import React from 'react';

const StatisticsPanel = ({ data }) => {
  const stats = data || {
    efficiency: 85.3,
    binsUsed: 2,
    totalItems: 15,
    spaceUtilized: 78.5,
    wastedSpace: 21.5,
    algorithm: 'py3dbp_maxrects'
  };

  return (
    <div style={{ color: 'white' }}>
      <h2>📊 Packing Statistics</h2>
      
      <div style={{
        background: '#34495e',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        {/* Efficiency Circle */}
        <div style={{ 
          position: 'relative', 
          width: '150px', 
          height: '150px',
          margin: '0 auto 20px'
        }}>
          <div style={{
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            background: `conic-gradient(#2ecc71 0% ${stats.efficiency}%, #e74c3c ${stats.efficiency}% 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: '#2c3e50',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column'
            }}>
              <span style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {stats.efficiency}%
              </span>
              <span style={{ fontSize: '12px', color: '#bdc3c7' }}>Efficiency</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr',
          gap: '15px',
          marginTop: '20px'
        }}>
          <StatCard 
            title="Bins Used" 
            value={stats.binsUsed} 
            icon="📦"
            color="#3498db"
          />
          <StatCard 
            title="Total Items" 
            value={stats.totalItems} 
            icon="📦"
            color="#2ecc71"
          />
          <StatCard 
            title="Space Used" 
            value={`${stats.spaceUtilized || 0}%`} 
            icon="📐"
            color="#f39c12"
          />
          <StatCard 
            title="Wasted" 
            value={`${stats.wastedSpace || 0}%`} 
            icon="🗑️"
            color="#e74c3c"
          />
        </div>

        {/* Algorithm Info */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: '#2c3e50',
          borderRadius: '5px',
          fontSize: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
            <span>⚙️</span>
            <strong>Algorithm:</strong>
            <span style={{ color: '#3498db' }}>{stats.algorithm || 'MaxRects'}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#bdc3c7' }}>
            Optimal packing using 3D bin packing algorithm
          </div>
        </div>

        {/* Packing Tips */}
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ marginBottom: '10px' }}>💡 Optimization Tips</h4>
          <ul style={{ 
            fontSize: '12px', 
            color: '#bdc3c7',
            paddingLeft: '20px'
          }}>
            <li>Rotate items to fit better</li>
            <li>Sort items by volume (largest first)</li>
            <li>Consider weight distribution</li>
            <li>Use multiple bins for better efficiency</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// Helper component for stat cards
const StatCard = ({ title, value, icon, color }) => (
  <div style={{
    background: '#2c3e50',
    padding: '15px',
    borderRadius: '8px',
    textAlign: 'center',
    borderLeft: `4px solid ${color}`
  }}>
    <div style={{ fontSize: '24px', marginBottom: '5px' }}>{icon}</div>
    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{value}</div>
    <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '5px' }}>{title}</div>
  </div>
);

export default StatisticsPanel;