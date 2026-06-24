import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    try {
      if (isRegistering) {
        // Đăng ký
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setMessage('Đăng ký thành công! Vui lòng kiểm tra Email (Hộp thư đến/Spam) để xác thực tài khoản trước khi đăng nhập.');
        setIsRegistering(false); // Chuyển về màn hình đăng nhập
        auth.signOut(); // Đăng xuất để chờ xác thực
      } else {
        // Đăng nhập
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          setError('Tài khoản chưa được xác thực. Vui lòng kiểm tra Email để xác thực!');
          auth.signOut();
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError('Sai email hoặc mật khẩu!');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email này đã được sử dụng!');
      } else {
        setError(err.message);
      }
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 className="text-gradient" style={{ textAlign: 'center', marginBottom: '2rem' }}>Welcome to Synapse</h2>

        {error && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

        {message && <div style={{ color: 'var(--success)', marginBottom: '1rem', fontSize: '0.875rem' }}>{message}</div>}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Email</label>
            <input
              type="email"
              className="input-field"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
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
            />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>
            {isRegistering ? 'Đăng ký' : 'Đăng nhập'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {isRegistering ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
          </span>
          <span 
            onClick={() => setIsRegistering(!isRegistering)} 
            style={{ color: 'var(--primary)', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600 }}
          >
            {isRegistering ? 'Đăng nhập' : 'Tạo tài khoản'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', margin: '2rem 0', color: 'var(--text-muted)' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
          <span style={{ padding: '0 1rem', fontSize: '0.875rem' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
        </div>

        <button onClick={handleGoogleSignIn} className="btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
