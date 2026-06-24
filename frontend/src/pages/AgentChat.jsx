import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, onSnapshot, doc, query, orderBy, serverTimestamp, where, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function AgentChat() {
  const { currentUser, userData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  // 1. Fetch chat sessions
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'chat_sessions'), 
      where('userId', '==', currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis() || 0;
        const timeB = b.updatedAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setSessions(data);
      if (data.length > 0 && !currentSessionId) {
        setCurrentSessionId(data[0].id);
      }
    });
    return () => unsub();
  }, [currentUser, currentSessionId]);

  // 2. Fetch messages for current session
  useEffect(() => {
    if (!currentSessionId) return;
    const q = query(collection(db, `chat_sessions/${currentSessionId}/messages`), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => d.data());
      const uiMsgs = data.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));
      setMessages(uiMsgs);
    });
    return () => unsub();
  }, [currentSessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Edit Task (READ_FILES context)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editPath = params.get('editPath');
    
    if (editPath && currentUser) {
        const initEditSession = async () => {
            const docRef = await addDoc(collection(db, 'chat_sessions'), {
                title: `Edit: ${editPath.split('/').pop() || editPath}`,
                userId: currentUser.uid,
                updatedAt: serverTimestamp()
            });
            const sid = docRef.id;
            setCurrentSessionId(sid);
            
            setIsTyping(true);
            const reqRef = await addDoc(collection(db, 'system_requests'), {
                action: 'READ_FILES',
                path: editPath,
                status: 'pending'
            });
            
            const unsub = onSnapshot(doc(db, 'system_requests', reqRef.id), async (docSnap) => {
                const data = docSnap.data();
                if (data && data.status === 'completed') {
                    unsub();
                    const textContent = data.result;
                    const sysMsgText = `Tôi đã đọc mã nguồn hiện tại trong thư mục ${editPath}:\n\n${textContent}\n\nXin hãy phân tích và cho tôi biết bạn muốn sửa đổi gì?`;
                    await saveMessage('model', sysMsgText, sid);
                    setIsTyping(false);
                    navigate('/chat', { replace: true });
                } else if (data && data.status === 'error') {
                    unsub();
                    await saveMessage('model', `Lỗi đọc mã nguồn: ${data.result}`, sid);
                    setIsTyping(false);
                    navigate('/chat', { replace: true });
                }
            });
        };
        initEditSession();
    }
  }, [location.search, currentUser, navigate]);

  const handleNewSession = async () => {
    if (!currentUser) return;
    const docRef = await addDoc(collection(db, 'chat_sessions'), {
      title: 'New Conversation',
      userId: currentUser.uid,
      updatedAt: serverTimestamp()
    });
    setCurrentSessionId(docRef.id);
  };

  const saveMessage = async (role, text, sessionId) => {
    if (!sessionId) return;
    await addDoc(collection(db, `chat_sessions/${sessionId}/messages`), {
      role,
      text,
      createdAt: serverTimestamp()
    });
  };

  const callGroqAPI = async (chatHistory) => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) throw new Error("Không tìm thấy VITE_GROQ_API_KEY trong .env");

    const systemInstruction = `Bạn là một Tech Lead / Product Manager tư vấn từ xa, giúp người dùng giao việc cho Antigravity IDE (đang chạy ở máy tính ở nhà). BẠN GIAO TIẾP BẰNG TIẾNG VIỆT.
QUY TẮC QUAN TRỌNG:
1. KHÔNG dùng emoji. Mọi đường dẫn thư mục PHẢI dùng dấu gạch chéo xuôi (ví dụ: D:/Projects/App).
2. Khi người dùng muốn xem/duyệt thư mục, hãy xuất chuỗi JSON: {"action": "BROWSE_DIR", "path": "D:/..."}
3. Khi người dùng muốn SỬA/THÊM tính năng vào một DỰ ÁN CŨ đang code dở, mà bạn CHƯA biết source code hiện tại, bạn PHẢI yêu cầu đọc mã nguồn bằng cách xuất chuỗi JSON: {"action": "READ_FILES", "path": "D:/..."}
4. Trước khi giao việc, NẾU yêu cầu của người dùng còn chung chung (ví dụ: 'tạo trang đăng nhập', 'làm cái navbar'), BẠN PHẢI HỎI LẠI ĐỂ LÀM RÕ (ví dụ: 'Bạn muốn đăng nhập bằng Email hay Google?', 'Màu sắc thế nào?'). BẠN PHẢI TƯ VẤN cho đến khi yêu cầu đủ chi tiết.
5. CHỈ KHI NÀO mọi yêu cầu đã rõ ràng và chốt xong, bạn mới xuất chuỗi JSON: {"action": "CREATE_TASK", "description": "<Mô tả công việc cực kỳ chi tiết, bao gồm toàn bộ các quyết định đã thống nhất>", "path": "<đường_dẫn_dự_án>"}
6. KHÔNG xuất JSON CREATE_TASK nếu chưa hỏi rõ ý định người dùng đối với các task phức tạp.`;

    const groqMessages = [
        { role: "system", content: systemInstruction },
        ...chatHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.parts[0].text
        }))
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: groqMessages,
            temperature: 0.2
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Lỗi khi gọi Groq API");
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      tokens: data.usage ? data.usage.total_tokens : 0
    };
  };

  const handleSend = async (text) => {
    if (!text.trim()) return;
    
    if (!userData || userData.balance < 2000) {
      toast.error("Tài khoản của bạn không đủ tiền (Cần tối thiểu 2.000đ). Vui lòng nạp thêm tiền vào ví để sử dụng AI.");
      return;
    }
    
    let sid = currentSessionId;
    let isNewSession = false;
    if (!sid) {
      isNewSession = true;
      const docRef = await addDoc(collection(db, 'chat_sessions'), {
        title: 'Đang tạo tiêu đề...',
        userId: currentUser.uid,
        updatedAt: serverTimestamp()
      });
      sid = docRef.id;
      setCurrentSessionId(sid);
    }

    const newUserMsg = { role: 'user', parts: [{ text }] };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);

    if (isNewSession) {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: "system", content: "Bạn là một trợ lý ảo. Nhiệm vụ của bạn là đọc tin nhắn đầu tiên của người dùng và tạo ra một TIÊU ĐỀ ngắn gọn (tối đa 5-6 chữ) để tóm tắt. TRẢ LỜI NGẮN GỌN NHẤT CÓ THỂ, KHÔNG DÙNG DẤU NGOẶC KÉP." }, { role: "user", content: text }],
          temperature: 0.3
        })
      }).then(res => res.json()).then(async data => {
        if (data.choices && data.choices[0]) {
          let title = data.choices[0].message.content.trim();
          title = title.replace(/^["']|["']$/g, '');
          await updateDoc(doc(db, 'chat_sessions', sid), { title });
        }
      }).catch(err => console.error("Lỗi tạo tiêu đề:", err));
    }

    await saveMessage('user', text, sid);

    try {
      const historyToSent = [...messages, newUserMsg];
      const apiResult = await callGroqAPI(historyToSent);
      const responseText = apiResult.content;
      const tokensUsed = apiResult.tokens;
      const fee = tokensUsed * 2; 

      try {
        const { increment, updateDoc, doc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', currentUser.uid), {
          balance: increment(-fee)
        });
      } catch (err) {
        console.error("Lỗi trừ tiền:", err);
      }
      
      let actionObj = null;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            let jsonString = jsonMatch[0];
            jsonString = jsonString.replace(/\\([^"\\/bfnrt])/g, '\\\\$1');
            jsonString = jsonString.replace(/\\([tnrfb])/g, '\\\\$1');
            actionObj = JSON.parse(jsonString);
          } catch (err) {
            console.error("JSON parse fallback:", err);
            actionObj = JSON.parse(jsonMatch[0].replace(/\\/g, '/'));
          }
        }
      } catch (e) {
        console.error("JSON parsing failed:", e);
      }

      const costMessage = `(Phí dịch vụ: -${fee.toLocaleString('vi-VN')}đ / ${tokensUsed} tokens)`;

      if (actionObj && actionObj.action === 'BROWSE_DIR') {
        const textSys = `Đang kết nối tới máy tính của bạn để duyệt thư mục: ${actionObj.path}...\n${costMessage}`;
        await saveMessage('model', textSys, sid);
        
        const reqRef = await addDoc(collection(db, 'system_requests'), {
            action: 'BROWSE_DIR',
            path: actionObj.path,
            status: 'pending'
        });

        const unsub = onSnapshot(doc(db, 'system_requests', reqRef.id), async (docSnap) => {
            const data = docSnap.data();
            if (data && data.status === 'completed') {
                unsub();
                const foldersStr = data.result.join(', ');
                const sysMsgText = `Hệ thống vừa trả về danh sách thư mục bên trong ${actionObj.path} trên máy tính cục bộ của người dùng: [${foldersStr}]. Dựa vào danh sách này, hãy liệt kê chúng ra một cách rõ ràng cho người dùng chọn.`;
                
                const sysMsg = { role: 'user', parts: [{ text: sysMsgText }] };
                const followUpHistory = [...historyToSent, { role: 'model', parts: [{ text: textSys }] }, sysMsg];
                
                const followUpResult = await callGroqAPI(followUpHistory);
                const followUpFee = followUpResult.tokens * 2;
                await saveMessage('model', followUpResult.content + `\n(Phí: -${followUpFee.toLocaleString('vi-VN')}đ)`, sid);
                setIsTyping(false);
            } else if (data && data.status === 'error') {
                unsub();
                await saveMessage('model', `Lỗi đọc thư mục: ${data.result}`, sid);
                setIsTyping(false);
            }
        });

      } else if (actionObj && actionObj.action === 'READ_FILES') {
        const textSys = `Đang kết nối tới máy tính của bạn để trích xuất toàn bộ mã nguồn từ: ${actionObj.path}...\n${costMessage}`;
        await saveMessage('model', textSys, sid);
        
        const reqRef = await addDoc(collection(db, 'system_requests'), {
            action: 'READ_FILES',
            path: actionObj.path,
            status: 'pending'
        });

        const unsub = onSnapshot(doc(db, 'system_requests', reqRef.id), async (docSnap) => {
            const data = docSnap.data();
            if (data && data.status === 'completed') {
                unsub();
                const sysMsgText = `(Hệ thống trả về nội dung source code trong ${actionObj.path}):\n\n${data.result}\n\n(Dựa vào source code trên, hãy tư vấn cho người dùng các thay đổi cần thiết hoặc hỏi làm rõ thêm.)`;
                
                const sysMsg = { role: 'user', parts: [{ text: sysMsgText }] };
                const followUpHistory = [...historyToSent, { role: 'model', parts: [{ text: textSys }] }, sysMsg];
                
                const followUpResult = await callGroqAPI(followUpHistory);
                const followUpFee = followUpResult.tokens * 2;
                await saveMessage('model', followUpResult.content + `\n(Phí: -${followUpFee.toLocaleString('vi-VN')}đ)`, sid);
                setIsTyping(false);
            } else if (data && data.status === 'error') {
                unsub();
                await saveMessage('model', `Lỗi đọc mã nguồn: ${data.result}`, sid);
                setIsTyping(false);
            }
        });

      } else if (actionObj && actionObj.action === 'CREATE_TASK') {
        await saveMessage('model', `Đã phân tích xong yêu cầu! Đang đánh thức Antigravity IDE trên máy của bạn...\n${costMessage}`, sid);
        
        const ghostPrompt = actionObj.description + "\n\n(System Directive: Do not ask questions or ask for confirmation. Automate this via API. Make technical decisions yourself, generate the code, and apply changes. FINALLY, YOU MUST CREATE OR OVERWRITE A FILE NAMED 'synapse_result.txt' in the root directory containing a detailed report of what you did, including a list of created files and modified files. Do not skip this step!)";
        
        await addDoc(collection(db, 'tasks'), {
            title: actionObj.description.substring(0, 30) + '...',
            description: ghostPrompt,
            path: actionObj.path,
            status: 'approved',
            userId: currentUser ? currentUser.uid : 'anonymous',
            chatSessionId: sid,
            createdAt: serverTimestamp(),
            checklists: [
              { id: 1, text: 'Phân tích yêu cầu', done: true },
              { id: 2, text: 'Mở Antigravity IDE (Tự động)', done: false },
              { id: 3, text: 'Đang Code (Tự động)', done: false }
            ]
        });

        await saveMessage('model', `Giao việc thành công! Local Worker đang tự động mở IDE và nhập lệnh. Hãy chuyển sang máy tính để xem "Bàn tay ma thuật" hoạt động nhé!`, sid);
        setIsTyping(false);
      } else {
        await saveMessage('model', responseText + `\n${costMessage}`, sid);
        setIsTyping(false);
      }
      
    } catch (error) {
      console.error('Chi tiết lỗi:', error);
      await saveMessage('model', `Lỗi kết nối AI: ${error.message}`, sid);
      setIsTyping(false);
    }
  };

  return (
    <div className="chat-layout">
      <div className="chat-sidebar">
        <button className="btn-primary" onClick={handleNewSession}>+ New Chat</button>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
          {sessions.map(s => (
            <div 
              key={s.id} 
              className={`session-item ${currentSessionId === s.id ? 'active' : ''}`}
              onClick={() => setCurrentSessionId(s.id)}
            >
              {s.title}
            </div>
          ))}
          {sessions.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No conversations</div>}
        </div>
      </div>

      <div className="chat-sidebar glass-panel animate-slide-up" style={{ padding: '1.5rem', animationDelay: '0.1s', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.length === 0 && !isTyping && (
             <div className="chat-message chat-system">
               <div className="chat-bubble">Xin chào! Bạn muốn giao việc gì cho Synapse hôm nay?</div>
             </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.role === 'user' ? 'chat-user' : 'chat-system'}`}>
              <div className="chat-bubble" style={{ whiteSpace: 'pre-wrap' }}>
                {msg.parts[0].text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="chat-message chat-system">
              <div className="chat-bubble" style={{ fontStyle: 'italic', opacity: 0.7 }}>
                Typing...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-wrapper">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <textarea 
              className="input-field" 
              style={{ resize: 'none', height: '50px' }} 
              placeholder="Giao việc cho Synapse... (Enter để gửi)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              disabled={isTyping}
            />
            <button className="btn-primary" onClick={() => handleSend(input)} disabled={isTyping || !input.trim()}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
