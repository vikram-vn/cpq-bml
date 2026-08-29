import React, { useEffect, useState } from 'react';

/**
 * Displays live CPU and memory usage statistics from the extension host.
 * It requests stats every 2 seconds via VS Code message passing.
 */
export default function PerformanceMonitor() {
  const [stats, setStats] = useState({ cpu: 0, memory: 0 });

  useEffect(() => {
    const requestStats = () => {
      window.vscodeApi && window.vscodeApi.postMessage({ type: 'requestPerformanceStats' });
    };
    requestStats();
    const interval = setInterval(requestStats, 2000);
    const handler = (event) => {
      const msg = event.data;
      if (msg.type === 'performanceStats') {
        setStats({ cpu: msg.cpu, memory: msg.memory });
      }
    };
    window.addEventListener('message', handler);
    return () => {
      clearInterval(interval);
      window.removeEventListener('message', handler);
    };
  }, []);

  return (
    <div className="performance-monitor" style={{ marginTop: '16px' }}>
      <strong>Performance:</strong> CPU {stats.cpu.toFixed(1)}% | Memory {stats.memory} MB
    </div>
  );
}
