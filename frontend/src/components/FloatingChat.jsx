import { useState, useRef, useEffect } from 'react';

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const newMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      const history = [...messages, newMsg].map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'Bạn là Synapse, trợ lý AI thân thiện. Trả lời ngắn gọn, trực tiếp, bằng tiếng Việt.' },
              ...history
            ],
            temperature: 0.5
        })
      });

      const data = await res.json();
      const botText = data.choices[0].message.content;
      setMessages(prev => [...prev, { role: 'model', text: botText }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: 'Lỗi kết nối AI.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'var(--primary)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 9999,
          fontSize: '24px'
        }}
      >
        {isOpen ? '✕' : '💬'}
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="glass-panel" style={{
          position: 'fixed',
          bottom: '100px',
          right: '2rem',
          width: '350px',
          height: '500px',
          zIndex: 9998,
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Synapse Assistant</h3>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem', fontSize: '0.875rem' }}>
                Hỏi Synapse bất cứ điều gì...
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                padding: '0.5rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                fontSize: '0.875rem'
              }}>
                {m.text}
              </div>
            ))}
            {isTyping && <div style={{ alignSelf: 'flex-start', fontSize: '0.75rem', opacity: 0.7 }}>Đang gõ...</div>}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: '1rem', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.9)' }}>
            <input 
              type="text" 
              className="input-field" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Nhập tin nhắn..." 
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}
            />
            <button className="btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={handleSend} disabled={!input.trim()}>Gửi</button>
          </div>
        </div>
      )}
    </>
  );
}
