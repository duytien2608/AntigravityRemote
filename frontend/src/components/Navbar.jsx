import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Navbar() {
  const location = useLocation();
  const { currentUser, userData, isAdmin } = useAuth();
  const [showDeposit, setShowDeposit] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '24px', height: '24px', background: 'var(--brand-gradient)', borderRadius: 'var(--radius-sm)' }}></div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Synapse</h1>
        </div>

        {currentUser && (
          <>
            <nav className="nav-links">
              <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
              <Link to="/chat" className={location.pathname === '/chat' ? 'active' : ''}>Agent Chat</Link>
              <Link to="/logs" className={location.pathname === '/logs' ? 'active' : ''}>Log Monitor</Link>
              {isAdmin && <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''} style={{ color: 'var(--danger)' }}>Admin</Link>}
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                onClick={() => setShowDeposit(true)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--glass-border)', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ví:</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--success)' }}>
                  {userData?.balance ? userData.balance.toLocaleString('vi-VN') : 0} ₫
                </span>
                <span style={{ fontSize: '0.75rem', background: 'var(--brand-gradient)', padding: '2px 6px', borderRadius: '4px', color: 'white', marginLeft: '4px' }}>Nạp</span>
              </div>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>{currentUser.email}</span>
              <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>Đăng xuất</button>
            </div>
          </>
        )}
      </header>

      {/* Deposit Modal */}
      {showDeposit && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel animate-slide-up" style={{ width: '90%', maxWidth: '400px', position: 'relative' }}>
            <button
              onClick={() => setShowDeposit(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
            >
              ✕
            </button>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.5rem' }}>Nạp tiền vào ví</h2>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)', marginBottom: '1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>Vui lòng nhập số tiền muốn nạp. Hệ thống sẽ tự động tạo mã QR thanh toán PayOS.</p>

              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Số tiền (VNĐ):</label>
                <input
                  type="number"
                  id="depositAmount"
                  className="input-field"
                  defaultValue={50000}
                  min={10000}
                  step={10000}
                />
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1rem' }}>
              Sau khi quét mã thành công, tiền sẽ được cộng ngay lập tức.
            </p>
            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={async () => {
                const amount = Number(document.getElementById('depositAmount').value);
                if (amount < 10000) return toast.error('Số tiền nạp tối thiểu là 10.000đ');

                try {
                  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                  const res = await fetch(`${API_URL}/create-payment-link`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount, userId: currentUser.uid })
                  });
                  const data = await res.json();
                  if (data.checkoutUrl) {
                    window.location.href = data.checkoutUrl;
                  } else {
                    toast.error('Lỗi tạo mã thanh toán: ' + JSON.stringify(data));
                  }
                } catch (error) {
                  toast.error('Không thể kết nối đến Backend Server: ' + error.message);
                }
              }}
            >
              Tạo mã QR Thanh toán
            </button>
          </div>
        </div>
      )}
    </>
  );
}
