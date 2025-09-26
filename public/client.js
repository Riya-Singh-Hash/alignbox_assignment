// public/client.js - clean client for chat UI
document.addEventListener('DOMContentLoaded', () => {
  if (!window.io) {
    console.error('Socket.IO client not found');
    return;
  }
  const socket = io();
  socket.on('connect', () => console.log('Socket connected', socket.id));
  socket.on('disconnect', () => console.log('Socket disconnected'));
  socket.on('message', (m) => { console.log('socket <- message', m); renderMessage(m); });

  const messagesEl = document.getElementById('messages');
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const toggle = document.getElementById('anonToggle');
  const currentUserSpan = document.getElementById('currentUser');
  if (!messagesEl || !input || !sendBtn) {
    console.error('Missing DOM elements: messages, messageInput or sendBtn');
    return;
  }

  const REAL_USER = { username: 'Riya', color: '#27ae60' };
  const ANON_USER = { username: 'Anonymous', color: '#c0392b' };
  let USER = toggle && toggle.checked ? ANON_USER : REAL_USER;
  if (currentUserSpan) currentUserSpan.textContent = USER.username;
  if (toggle) {
    toggle.addEventListener('change', () => {
      USER = toggle.checked ? ANON_USER : REAL_USER;
      if (currentUserSpan) currentUserSpan.textContent = USER.username;
    });
  }

  function sendMessage() {
    const content = input.value.trim();
    if (!content) return;
    const msg = { username: USER.username, content, color: USER.color };
    console.log('Sending message', msg);
    if (socket && socket.connected) {
      socket.emit('sendMessage', msg);
    } else {
      // fallback to HTTP
      fetch('/messages', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(msg) })
        .then(r=>r.json()).then(m=>console.log('POST saved', m)).catch(e=>console.error('POST err', e));
    }
    input.value = '';
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e)=>{ if (e.key==='Enter') sendMessage(); });

  // load history
  fetch('/messages').then(r=>r.json()).then(list=>{ list.forEach(renderMessage); }).catch(e=>console.error('history err', e));

  function renderMessage(msg) {
    const isMine = msg.username === REAL_USER.username;
    const row = document.createElement('div');
    row.className = 'msg-row ' + (isMine ? 'right' : 'left');
    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + (isMine ? 'right' : 'left');
    bubble.innerHTML = `${!isMine ? `<div class="username">${escapeHtml(msg.username)}</div>` : ''}<div class="text">${escapeHtml(msg.content)}</div><div class="meta">${formatTime(msg.created_at || new Date())} ${isMine ? '✔✔' : ''}</div>`;
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(t){ const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
  function formatTime(ts){ const d=new Date(ts); const hh=d.getHours(); const mm=String(d.getMinutes()).padStart(2,'0'); const am=hh>=12?'PM':'AM'; const h12=hh%12||12; return `${h12}:${mm} ${am}`; }
});
