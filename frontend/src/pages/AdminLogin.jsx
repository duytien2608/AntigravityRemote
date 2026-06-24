import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAdminSignIn = async (e) => {
    e.preventDefault();
    setError('');
    
    // Hardcode check before attempting to login
    if (email !== 'synapse@admin.com') {
      setError('Tài khoản không có quyền Admin!');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        // Tự động tạo tài khoản Admin nếu chưa tồn tại
        if (email === 'synapse@admin.com') {
          try {
            const { createUserWithEmailAndPassword } = await import('firebase/auth');
            await createUserWithEmailAndPassword(auth, email, password);
            navigate('/admin');
          } catch (createErr) {
            if (createErr.code === 'auth/email-already-in-use') {
              setError('Sai mật khẩu Admin!');
            } else {
              setError(createErr.message);
            }
          }
        } else {
          setError('Sai email hoặc mật khẩu!');
        }
      } else {
        setError(err.message);
      }
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', borderTop: '4px solid var(--danger)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Admin Portal</h2>
        <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--danger)', fontSize: '0.875rem', fontWeight: 600 }}>RESTRICTED ACCESS</p>

        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '4px' }}>{error}</div>}

        <form onSubmit={handleAdminSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Admin Email</label>
            <input
              type="email"
              className="input-field"
              placeholder="admin@synapse.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: '1rem', background: 'linear-gradient(135deg, var(--danger), #b91c1c)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}>
            Truy cập Admin
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <span 
            onClick={() => navigate('/login')} 
            style={{ color: 'var(--text-muted)', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Quay lại trang đăng nhập thường
          </span>
        </div>
      </div>
    </div>
  );
}
