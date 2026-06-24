import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

export default function LogMonitor() {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    // Lấy logs của user này (không dùng orderBy để tránh lỗi thiếu Index)
    const q = query(
      collection(db, 'logs'),
      where('userId', '==', currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setLogs(data);
    });
    return () => unsub();
  }, [currentUser]);

  return (
    <div className="container animate-fade-in" style={{ marginTop: '2rem', maxWidth: '1000px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2>System Logs</h2>
          <p style={{ color: 'var(--text-muted)' }}>Real-time logs from Synapse Worker</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {logs.length === 0 && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            Chưa có log hệ thống nào.
          </div>
        )}
        {logs.map(log => (
          <div key={log.id} className="glass-panel" style={{ borderLeft: `4px solid ${log.type === 'error' ? 'var(--danger)' : 'var(--warning)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '600' }}>{log.app || 'SynapseWorker'}</span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {log.createdAt?.toDate().toLocaleString() || 'Vừa xong'}
                  </span>
                </div>
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', display: 'block', color: log.type === 'error' ? '#fca5a5' : '#fde047', fontFamily: 'monospace', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                  {log.message}
                </code>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
