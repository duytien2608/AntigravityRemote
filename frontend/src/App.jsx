import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import LogMonitor from './pages/LogMonitor';
import AgentChat from './pages/AgentChat';
import Admin from './pages/Admin';
import Navbar from './components/Navbar';
import FloatingChat from './components/FloatingChat';
import { AuthProvider, useAuth } from './context/AuthContext';
import './index.css';

const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { currentUser, isAdmin } = useAuth();
  if (!currentUser) return <Navigate to="/admin/login" />;
  if (!isAdmin) return <Navigate to="/admin/login" />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Navbar />
        <div className="container animate-fade-in">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/logs" element={<PrivateRoute><LogMonitor /></PrivateRoute>} />
            <Route path="/chat" element={<PrivateRoute><AgentChat /></PrivateRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          </Routes>
        </div>
        <FloatingChat />
      </Router>
    </AuthProvider>
  );
}

export default App;
