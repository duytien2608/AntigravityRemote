import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, addDoc, onSnapshot, query, serverTimestamp, doc, updateDoc, where, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [desc, setDesc] = useState('');
  const [path, setPath] = useState('');
  const [expandedTasks, setExpandedTasks] = useState({});
  const [chatHistories, setChatHistories] = useState({});

  // States cho Browse Dir
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [browsePath, setBrowsePath] = useState('D:/');
  const [browseItems, setBrowseItems] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  // States cho Giám sát và Điều khiển
  const [liveScreenshot, setLiveScreenshot] = useState(null);
  const [terminalCmds, setTerminalCmds] = useState({});
  const [terminalResults, setTerminalResults] = useState({});

  // Xử lý khi PayOS trả về
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    if (status === 'success') {
      toast.success('Tạo giao dịch thành công! Vui lòng quét mã và chờ hệ thống tự động cộng tiền.');
      navigate('/dashboard', { replace: true });
    } else if (status === 'cancel') {
      toast.error('Đã hủy giao dịch nạp tiền.');
      navigate('/dashboard', { replace: true });
    }
  }, [location, navigate]);

  // Lắng nghe tasks từ Firestore theo userId
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setTasks(data);
    }, (error) => {
      console.error("Lỗi lấy dữ liệu Dashboard:", error);
    });
    return () => unsub();
  }, [currentUser]);

  // Lắng nghe Camera Giám sát IDE
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, 'system', `live_monitor_${currentUser.uid}`), (docSnap) => {
      if (docSnap.exists() && docSnap.data().screenshot) {
        setLiveScreenshot(docSnap.data().screenshot);
      }
    });
    return () => unsub();
  }, [currentUser]);

  const handleIDEKeystroke = async (taskId, path, keys) => {
    try {
      await addDoc(collection(db, 'system_requests'), {
        action: 'IDE_KEYSTROKE',
        taskId,
        path,
        keys,
        status: 'pending'
      });
      toast.success("Đã gửi lệnh phím từ xa: " + keys);
    } catch (err) {
      toast.error("Lỗi gửi lệnh: " + err.message);
    }
  };

  const handleRunTerminal = async (taskId, path) => {
    const cmd = terminalCmds[taskId];
    if (!cmd) return;
    try {
      setTerminalResults(prev => ({ ...prev, [taskId]: "Đang chạy..." }));
      const docRef = await addDoc(collection(db, 'system_requests'), {
        action: 'RUN_COMMAND',
        path,
        command: cmd,
        status: 'pending'
      });
      onSnapshot(doc(db, 'system_requests', docRef.id), (snap) => {
        const data = snap.data();
        if (data && data.status === 'completed') {
          setTerminalResults(prev => ({ ...prev, [taskId]: data.result }));
        } else if (data && data.status === 'error') {
          setTerminalResults(prev => ({ ...prev, [taskId]: "Lỗi: " + data.result }));
        }
      });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleBrowse = async (targetPath) => {
    if (!targetPath) return;
    setIsBrowsing(true);
    setBrowseLoading(true);
    setBrowsePath(targetPath);

    try {
      const docRef = await addDoc(collection(db, 'system_requests'), {
        action: 'BROWSE_DIR',
        path: targetPath,
        status: 'pending'
      });

      const unsub = onSnapshot(doc(db, 'system_requests', docRef.id), (snap) => {
        const data = snap.data();
        if (data && data.status === 'completed') {
          setBrowseItems(data.result);
          setBrowseLoading(false);
          unsub();
        } else if (data && data.status === 'error') {
          toast.error("Lỗi đọc thư mục: " + data.result);
          setBrowseLoading(false);
          unsub();
        }
      });
    } catch (err) {
      toast.error(err.message);
      setBrowseLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!desc || !path) return;

    try {
      await addDoc(collection(db, 'tasks'), {
        title: desc.substring(0, 30) + '...',
        description: desc,
        path: path,
        status: 'pending',
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
        checklists: [
          { id: 1, text: 'Phân tích yêu cầu', done: false },
          { id: 2, text: 'Thực thi mã nguồn', done: false },
          { id: 3, text: 'Kiểm thử (Testing)', done: false }
        ]
      });
      setDesc('');
      setPath('');
      toast.success("Đã giao việc thành công!");
    } catch (err) {
      toast.error("Lỗi giao việc: " + err.message);
    }
  };

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const toggleExpand = (task) => {
    const isExpanded = expandedTasks[task.id];
    setExpandedTasks(prev => ({
      ...prev,
      [task.id]: !isExpanded
    }));

    // Tải lịch sử chat nếu mở rộng và có chatSessionId
    if (!isExpanded && task.chatSessionId && !chatHistories[task.id]) {
      const q = query(collection(db, `chat_sessions/${task.chatSessionId}/messages`), orderBy('createdAt', 'asc'));
      onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => d.data());
        setChatHistories(prev => ({
          ...prev,
          [task.id]: data
        }));
      });
    }
  };

  const handleApproval = async (taskId, decision) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: decision === 'allow' ? 'approved' : 'denied',
        approved_at: serverTimestamp()
      });
      toast.success(decision === 'allow' ? "Đã cấp phép cho Local Worker" : "Đã từ chối hành động");
    } catch (err) {
      toast.error("Lỗi cập nhật: " + err.message);
    }
  };

  const handleDeleteTask = async (e, taskId) => {
    e.stopPropagation();
    if (window.confirm('Bạn có chắc chắn muốn xóa Task này không?')) {
      try {
        await deleteDoc(doc(db, 'tasks', taskId));
        toast.success("Đã xóa Task thành công");
      } catch (err) {
        toast.error("Lỗi xóa: " + err.message);
      }
    }
  };

  const renderTask = (task) => {
    const total = task.checklists?.length || 0;
    const done = task.checklists?.filter(c => c.done).length || 0;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    const isExpanded = expandedTasks[task.id];
    const messages = chatHistories[task.id] || [];

    return (
      <div
        key={task.id}
        className="task-card glass-panel"
        style={{
          flexShrink: 0,
          padding: '1.25rem',
          marginBottom: '1rem',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          border: '1px solid rgba(255,255,255,0.05)',
          background: 'linear-gradient(145deg, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0.8) 100%)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          borderRadius: '12px',
          position: 'relative',
          overflow: 'hidden'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)';
          e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
          e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)';
        }}
      >
        {/* Subtle accent line based on status */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '4px', height: '100%',
          background: task.status === 'completed' ? '#10b981' : (task.status === 'in-progress' || task.status === 'approved' ? '#8b5cf6' : '#64748b')
        }} />

        <div
          className="task-header"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: 'pointer', paddingLeft: '0.5rem' }}
          onClick={() => toggleExpand(task)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, paddingRight: '0.5rem', overflow: 'hidden' }}>
              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', lineHeight: '1.4', fontWeight: '600', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {task.title}
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, fontFamily: 'monospace', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ opacity: 0.5 }}>📁</span> {task.path}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', minWidth: '80px' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className={`badge badge-${task.status}`} style={{ fontSize: '0.65rem', padding: '4px 8px', letterSpacing: '0.5px', borderRadius: '4px', fontWeight: 'bold' }}>
                  {task.status.replace('_', ' ').toUpperCase()}
                </span>
                <button
                  onClick={(e) => handleDeleteTask(e, task.id)}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', padding: '4px 6px', borderRadius: '4px', transition: 'all 0.2s' }}
                  title="Xóa Task"
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                >
                  <i className="fas fa-trash"></i> 🗑️
                </button>
              </div>
              <span style={{ color: 'var(--brand)', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '1px', marginTop: '0.2rem', padding: '2px 6px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '4px' }}>
                {isExpanded ? 'COLLAPSE ▴' : 'EXPAND ▾'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1rem', paddingLeft: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Progress</span>
            <span style={{ fontWeight: '600', color: 'var(--brand)' }}>{progress}%</span>
          </div>
          <div className="progress-container" style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
            <div className="progress-bar" style={{ width: `${progress}%`, height: '100%', background: 'var(--brand-gradient)', transition: 'width 0.5s ease' }}></div>
          </div>
        </div>

        {isExpanded && (
          <div style={{ marginTop: '1rem', animation: 'fadeIn 0.3s ease-in-out', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>

            {['approved', 'in-progress'].includes(task.status) && liveScreenshot && (
              <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--brand)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ animation: 'pulse 1.5s infinite', display: 'inline-block', width: '8px', height: '8px', background: 'red', borderRadius: '50%' }}></span>
                  Live Monitor: Antigravity IDE
                </h4>
                <img src={liveScreenshot} alt="IDE Live" style={{ width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.1)' }} />

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button className="btn-primary" onClick={(e) => { e.stopPropagation(); handleIDEKeystroke(task.id, task.path, '^{ENTER}'); }} style={{ flex: 1 }}>🟢 Chấp nhận (Ctrl+Enter)</button>
                  <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); handleIDEKeystroke(task.id, task.path, '^{BACKSPACE}'); }} style={{ flex: 1, borderColor: '#ef4444', color: '#ef4444' }}>🔴 Từ chối (Ctrl+Backspace)</button>
                </div>
              </div>
            )}

            {task.resultReport && (
              <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--brand)' }}>
                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Báo cáo Kết quả (synapse_result.txt)</h4>
                <pre style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {task.resultReport}
                </pre>
              </div>
            )}

            {messages.length > 0 && (
              <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>Context History</h4>
                <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }}>
                  {messages.map((m, idx) => (
                    <div key={idx} style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      background: m.role === 'user' ? 'var(--brand-gradient)' : 'rgba(255,255,255,0.05)',
                      padding: '0.85rem 1.15rem',
                      borderRadius: 'var(--radius-md)',
                      maxWidth: '90%',
                      fontSize: '0.9rem',
                      lineHeight: '1.5',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: m.role === 'model' ? 'monospace' : 'inherit', fontSize: m.role === 'model' ? '0.85rem' : 'inherit' }}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Description</h4>
              <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', margin: 0, lineHeight: '1.5', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                {task.description}
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Remote Terminal</h4>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="npm run test..."
                  value={terminalCmds[task.id] || ''}
                  onChange={(e) => setTerminalCmds(prev => ({ ...prev, [task.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRunTerminal(task.id, task.path); }}
                  style={{ fontFamily: 'monospace', flex: 1 }}
                />
                <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); handleRunTerminal(task.id, task.path); }}>Run</button>
              </div>
              {terminalResults[task.id] && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#000', color: '#0f0', fontFamily: 'monospace', fontSize: '0.8rem', borderRadius: '4px', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: '200px' }}>
                  {terminalResults[task.id]}
                </div>
              )}
            </div>

            <div className="checklist">
              <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Checklists
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {task.checklists?.map((item, idx) => (
                  <div key={item.id} className="checklist-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => toggleChecklist(task.id, task.checklists, idx)}>
                    <div className={`checklist-checkbox ${item.done ? 'checked' : ''}`} style={{ width: '18px', height: '18px', border: '2px solid var(--brand)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: item.done ? 'var(--brand)' : 'transparent' }}>
                      {item.done && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
                    </div>
                    <span style={{ color: item.done ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: item.done ? 'line-through' : 'none', fontSize: '0.9rem' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {task.status === 'completed' && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                <button
                  className="btn-secondary"
                  style={{ padding: '10px 16px', fontSize: '0.85rem', width: '100%', borderColor: 'rgba(139, 92, 246, 0.5)', color: 'var(--brand)', background: 'rgba(139, 92, 246, 0.05)', letterSpacing: '1px', transition: 'all 0.2s ease' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/chat?editPath=${encodeURIComponent(task.path)}`);
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)'; }}
                >
                  EDIT TASK / RE-OPEN
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    );
  };

  const toggleChecklist = async (taskId, checklists, itemIndex) => {
    const newList = [...checklists];
    newList[itemIndex].done = !newList[itemIndex].done;
    await updateDoc(doc(db, 'tasks', taskId), {
      checklists: newList
    });
  };

  const handleDownloadExe = async () => {
    if (!currentUser) return;
    try {
      toast.loading('Đang tải và giải nén worker...', { id: 'download_worker' });
      // Tải file nén .gz từ thư mục public
      const response = await fetch('/SynapseWorker.exe.gz');
      if (!response.ok) throw new Error('Không tìm thấy file SynapseWorker.exe.gz');

      // Khởi tạo bộ giải nén ngay trên RAM của trình duyệt
      const ds = new DecompressionStream('gzip');
      const decompressedStream = response.body.pipeThrough(ds);
      
      // Chuyển stream đã giải nén thành Blob (file .exe nguyên bản)
      const blob = await new Response(decompressedStream).blob();
      
      // Tạo link tải và tự động đổi tên theo UID
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SynapseWorker_${currentUser.uid}.exe`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Tải và đổi tên Worker thành công!', { id: 'download_worker' });
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải Worker: ' + err.message, { id: 'download_worker' });
    }
  };

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '1000px', marginTop: '2rem' }}>
      <div className="glass-panel animate-slide-up" style={{ animationDelay: '0.1s', padding: '2rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.4) 100%)' }}>
        <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Assign New Task</h2>
          <button onClick={handleDownloadExe} className="btn-secondary" style={{ padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Tải xuống Synapse Worker (.exe)
          </button>
        </div>
        <form style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <div style={{ flex: '1 1 100%' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Task Description</label>
            <input
              type="text"
              className="input-field"
              placeholder="E.g., Create a new user profile page..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <div style={{ flex: '1 1 100%' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Project Path</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="input-field"
                placeholder="D:/Projects/my-app"
                value={path}
                onChange={(e) => setPath(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleBrowse(path || 'D:/')}
                style={{ padding: '0 1rem', whiteSpace: 'nowrap' }}
              >
                Duyệt
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" className="btn-primary" style={{ height: '45px' }} onClick={handleCreateTask}>
              Send to Synapse
            </button>
          </div>
        </form>
      </div>

      <div className="task-board-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        {[
          { id: 'pending', name: 'Pending', color: '#64748b' },
          { id: 'in-progress', name: 'In Progress', color: '#8b5cf6' },
          { id: 'completed', name: 'Completed', color: '#10b981' }
        ].map(col => (
          <div key={col.id} className="glass-panel" style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '16px', padding: '1.5rem', borderTop: `4px solid ${col.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>{col.icon}</span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#f8fafc', letterSpacing: '0.5px' }}>
                {col.name}
              </h3>
              <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                {tasks.filter(t => col.id === 'in-progress' ? ['in-progress', 'approved'].includes(t.status) : t.status === col.id).length}
              </span>
            </div>
            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', minHeight: '150px', maxHeight: '700px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {tasks.filter(t => col.id === 'in-progress' ? ['in-progress', 'approved'].includes(t.status) : t.status === col.id).map(task => renderTask(task))}
              {tasks.filter(t => col.id === 'in-progress' ? ['in-progress', 'approved'].includes(t.status) : t.status === col.id).length === 0 && (
                <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b', fontSize: '0.9rem', fontStyle: 'italic', padding: '2rem 0' }}>
                  Không có Task nào
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isBrowsing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
          <div className="glass-panel animate-slide-up" style={{ width: '600px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', padding: '1.5rem', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}></span> Duyệt thư mục từ xa
              </h3>
              <button onClick={() => setIsBrowsing(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem', padding: '0 0.5rem' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                className="input-field"
                value={browsePath}
                onChange={(e) => setBrowsePath(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleBrowse(browsePath) }}
                style={{ fontFamily: 'monospace' }}
              />
              <button className="btn-primary" onClick={() => handleBrowse(browsePath)}>Đi</button>
              <button className="btn-secondary" onClick={() => {
                let parts = browsePath.replace(/\\/g, '/').split('/');
                if (parts[parts.length - 1] === '') parts.pop();
                parts.pop();
                let newPath = parts.join('/') || 'D:/';
                if (!newPath.includes('/')) newPath += '/';
                handleBrowse(newPath);
              }}>⬆ Lên</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.5rem', minHeight: '250px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {browseLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', animation: 'pulse 1.5s infinite' }}>Đang quét hệ thống...</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {browseItems.map((item, idx) => {
                    const isDir = item.startsWith('[DIR] ');
                    const name = isDir ? item.replace('[DIR] ', '') : item;
                    return (
                      <li key={idx}
                        style={{
                          padding: '0.6rem 1rem',
                          cursor: isDir ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          borderRadius: '6px',
                          color: isDir ? 'var(--brand)' : 'var(--text-muted)',
                          transition: 'all 0.2s ease',
                          userSelect: 'none'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; if (!isDir) e.currentTarget.style.color = 'var(--text-main)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; if (!isDir) e.currentTarget.style.color = 'var(--text-muted)'; }}
                        onClick={() => {
                          if (isDir) {
                            const cleanPath = browsePath.replace(/\\/g, '/');
                            const newPath = cleanPath.endsWith('/') ? cleanPath + name : cleanPath + '/' + name;
                            handleBrowse(newPath);
                          }
                        }}
                      >
                        <span style={{ fontSize: '1.2rem', filter: isDir ? 'none' : 'grayscale(1)', opacity: isDir ? 1 : 0.5 }}>{isDir ? '📁' : '📄'}</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: isDir ? '500' : 'normal' }}>{name}</span>
                      </li>
                    );
                  })}
                  {browseItems.length === 0 && <li style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Thư mục trống</li>}
                </ul>
              )}
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => setIsBrowsing(false)}>Hủy</button>
              <button className="btn-primary" onClick={() => {
                setPath(browsePath);
                setIsBrowsing(false);
              }}>Chọn thư mục này</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
