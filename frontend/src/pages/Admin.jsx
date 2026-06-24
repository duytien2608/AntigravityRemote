import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

export default function Admin() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Trong thực tế, collection 'users' nên được bảo vệ bằng Firestore Rules
    const q = query(collection(db, 'users'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(data);
    });
    return () => unsub();
  }, []);

  const toggleLock = async (userId, currentStatus) => {
    await updateDoc(doc(db, 'users', userId), {
      isLocked: !currentStatus
    });
  };

  if (!currentUser) return <div>Loading...</div>;

  return (
    <div style={{ marginTop: '2rem' }}>
      <div className="glass-panel">
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent)' }}>Quản trị hệ thống (Admin Panel)</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Tại đây bạn có thể quản lý người dùng và khóa các tài khoản.
          Khi bị khóa, người dùng sẽ không thể đăng nhập và file .EXE dưới máy của họ sẽ bị vô hiệu hóa lập tức.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Email</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Quyền hạn</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Ngày tham gia</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Trạng thái</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem' }}>{u.email}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${u.role === 'admin' ? 'badge-completed' : 'badge-progress'}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${u.isLocked ? 'badge-pending' : 'badge-completed'}`} style={{ background: u.isLocked ? 'rgba(239, 68, 68, 0.2)' : '', color: u.isLocked ? '#ef4444' : '' }}>
                      {u.isLocked ? 'BỊ KHÓA' : 'HOẠT ĐỘNG'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                    {u.id !== currentUser.uid && (
                      <>
                        <button
                          className="btn-secondary"
                          onClick={() => toggleLock(u.id, u.isLocked)}
                          style={{ padding: '4px 12px', fontSize: '0.8rem', borderColor: u.isLocked ? 'var(--primary)' : '#ef4444', color: u.isLocked ? 'var(--primary)' : '#ef4444' }}
                        >
                          {u.isLocked ? 'Mở Khóa' : 'Khóa'}
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={async () => {
                            await updateDoc(doc(db, 'users', u.id), {
                              role: u.role === 'admin' ? 'user' : 'admin'
                            });
                          }}
                          style={{ padding: '4px 12px', fontSize: '0.8rem', borderColor: u.role === 'admin' ? 'var(--warning)' : 'var(--success)', color: u.role === 'admin' ? 'var(--warning)' : 'var(--success)' }}
                        >
                          {u.role === 'admin' ? 'Hạ quyền' : 'Cấp Admin'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
