import React from 'react';

const HistoryPanel = ({ history, onClear, onSelect }) => {
  if (history.length === 0) {
    return (
      <div style={{ color: 'white', textAlign: 'center', padding: '20px' }}>
        <h3>📜 History</h3>
        <p>No history yet</p>
        <p>Calculate packing to build history</p>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>📜 History ({history.length})</h3>
        <button 
          onClick={onClear}
          style={{
            background: '#e74c3c',
            padding: '5px 10px',
            fontSize: '12px'
          }}
        >
          Clear All
        </button>
      </div>
      
      <div style={{ maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>
        {history.map((entry) => (
          <div 
            key={entry.id}
            className={`history-item ${entry.data.efficiency >= 80 ? 'history-item-success' : 'history-item-error'}`}
            onClick={() => onSelect(entry)}
            style={{ marginBottom: '10px' }}
          >
            <div className="history-header">
              <strong>{entry.action.toUpperCase()}</strong>
              <span className="history-timestamp">
                {new Date(entry.timestamp).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
            
            <div className="history-stats">
              <div className="history-stat">
                <div>📦</div>
                <div>{entry.data.binsUsed} bins</div>
              </div>
              <div className="history-stat">
                <div>📊</div>
                <div>{entry.data.efficiency}% eff.</div>
              </div>
              <div className="history-stat">
                <div>📦</div>
                <div>{entry.data.totalItems} items</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="history-actions">
        <p style={{ fontSize: '12px', color: '#95a5a6', marginTop: '10px' }}>
          Click on any entry to load it
        </p>
      </div>
    </div>
  );
};

export default HistoryPanel;