'use strict';

// ══════════════════════════════════════════
// LAUNCHER
// ══════════════════════════════════════════
document.getElementById('btn-go-roster').addEventListener('click', () => {
  document.getElementById('screen-launcher').classList.add('hidden');
  document.getElementById('system-roster').classList.remove('hidden');
});

document.getElementById('btn-go-botdash').addEventListener('click', () => {
  document.getElementById('screen-launcher').classList.add('hidden');
  document.getElementById('system-botdash').classList.remove('hidden');
  BotDash.loadSavedConfig();
});

function goHome() {
  document.getElementById('system-roster').classList.add('hidden');
  document.getElementById('system-botdash').classList.add('hidden');
  document.getElementById('screen-launcher').classList.remove('hidden');
}

// ══════════════════════════════════════════
// ROSTER APP
// ══════════════════════════════════════════
const Roster = (function () {
  const $ = id => document.getElementById(id);

  const DEFAULT_API_URL = 'https://nongmai-production.up.railway.app';
  const state = {
    apiUrl: localStorage.getItem('roster-api-url') || DEFAULT_API_URL,
    token:  localStorage.getItem('roster-token') || '',
    user:   null
  };

  function showScreen(name) {
    ['config', 'auth', 'dashboard'].forEach(s => {
      $(`screen-${s}`).classList.toggle('hidden', s !== name);
    });
  }

  function showPage(name) {
    ['sessions', 'history', 'profile', 'admin-sessions', 'admin-users'].forEach(p => {
      $(`page-${p}`).classList.toggle('hidden', p !== name);
    });
    document.querySelectorAll('#system-roster .nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === name);
    });
    if (name === 'sessions')       loadSessions();
    if (name === 'history')        loadHistory();
    if (name === 'profile')        loadProfile();
    if (name === 'admin-sessions') adminLoadSessions();
    if (name === 'admin-users')    adminLoadUsers();
  }

  function toast(msg, type = 'info') {
    const el = $('toast');
    el.textContent = msg;
    el.className = `toast ${type}`;
    el.classList.remove('hidden');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 3500);
  }

  async function api(method, path, body) {
    const url = state.apiUrl.replace(/\/$/, '') + path;
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['x-roster-token'] = state.token;
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const MAX = 256;
          const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(img.width  * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          resolve({ base64: dataUrl.split(',')[1], mime: 'image/jpeg', dataUrl });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function h(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('th-TH', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }
  function fmtTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
  }
  function avatarFallback(username) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=5865f2&color=fff&size=64`;
  }

  // Init — runs when system-roster becomes visible
  async function init() {
    $('config-api-url').value = state.apiUrl;
    if (state.token) {
      try {
        const data = await api('GET', '/api/roster/me');
        state.user = data.user;
        setupDashboard();
        showScreen('dashboard');
        showPage('sessions');
      } catch {
        localStorage.removeItem('roster-token');
        state.token = '';
        showScreen('auth');
      }
    } else {
      showScreen('auth');
    }
  }

  // Config
  $('btn-config-save').addEventListener('click', async () => {
    const url = $('config-api-url').value.trim();
    if (!url) { $('config-error').textContent = 'กรุณาใส่ URL'; return; }
    const btn = $('btn-config-save');
    btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ...';
    $('config-error').textContent = '';
    try {
      const res = await fetch(url.replace(/\/$/, '') + '/api/health');
      if (!res.ok) throw new Error();
      state.apiUrl = url;
      localStorage.setItem('roster-api-url', url);
      showScreen('auth');
    } catch {
      $('config-error').textContent = '❌ เชื่อมต่อไม่ได้';
    } finally {
      btn.disabled = false; btn.textContent = 'เชื่อมต่อ';
    }
  });

  $('btn-back-from-config').addEventListener('click', e => { e.preventDefault(); goHome(); });
  $('btn-change-config').addEventListener('click', e => { e.preventDefault(); $('config-api-url').value = state.apiUrl; showScreen('config'); });
  $('btn-roster-back-home').addEventListener('click', e => { e.preventDefault(); goHome(); });
  $('btn-roster-home').addEventListener('click', () => goHome());

  // Auth tabs
  document.querySelectorAll('#system-roster .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#system-roster .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      $('tab-login').classList.toggle('hidden', tab !== 'login');
      $('tab-register').classList.toggle('hidden', tab !== 'register');
    });
  });

  // Login
  $('btn-login').addEventListener('click', () => doLogin());
  $('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  async function doLogin() {
    const username = $('login-username').value.trim();
    const password = $('login-password').value;
    if (!username || !password) { $('login-error').textContent = 'กรุณากรอกข้อมูล'; return; }
    const btn = $('btn-login');
    btn.disabled = true; btn.textContent = '⏳ กำลังเข้าสู่ระบบ...';
    $('login-error').textContent = '';
    try {
      const data = await api('POST', '/api/roster/login', { username, password });
      state.token = data.token; state.user = data.user;
      localStorage.setItem('roster-token', data.token);
      setupDashboard(); showScreen('dashboard'); showPage('sessions');
    } catch (err) {
      $('login-error').textContent = '❌ ' + err.message;
    } finally {
      btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
    }
  }

  // Register
  let regAvatarData = null;
  $('avatar-upload-area').addEventListener('click', () => $('reg-avatar').click());
  $('reg-avatar').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    $('avatar-ai-status').textContent = '⏳ กำลังเตรียมรูปภาพ...';
    try {
      const compressed = await compressImage(file);
      regAvatarData = compressed;
      const preview = $('avatar-preview');
      preview.src = compressed.dataUrl; preview.classList.remove('hidden');
      $('avatar-placeholder').classList.add('hidden');
      $('avatar-ai-status').textContent = '✅ เลือกรูปสำเร็จ — AI จะตรวจ 18+ เมื่อสมัคร';
    } catch { $('avatar-ai-status').textContent = '❌ ไม่สามารถอ่านรูปได้'; }
    e.target.value = '';
  });

  $('btn-register').addEventListener('click', () => doRegister());
  async function doRegister() {
    const username = $('reg-username').value.trim();
    const password = $('reg-password').value;
    const roblox   = $('reg-roblox').value.trim();
    const discord  = $('reg-discord').value.trim();
    if (!username || !password || !roblox) { $('register-error').textContent = '❌ กรุณากรอก username, password, ชื่อ Roblox'; return; }
    const btn = $('btn-register');
    btn.disabled = true; btn.textContent = '⏳ กำลังสมัคร...';
    $('register-error').textContent = '';
    try {
      const body = { username, password, roblox_name: roblox, discord_tag: discord || null };
      if (regAvatarData) { body.avatar_base64 = regAvatarData.base64; body.avatar_mime = regAvatarData.mime; }
      const data = await api('POST', '/api/roster/register', body);
      state.token = data.token; state.user = data.user;
      localStorage.setItem('roster-token', data.token);
      setupDashboard(); showScreen('dashboard'); showPage('sessions');
      toast('✅ สมัครสมาชิกสำเร็จ ยินดีต้อนรับ!', 'success');
    } catch (err) {
      $('register-error').textContent = '❌ ' + err.message;
    } finally {
      btn.disabled = false; btn.textContent = 'สมัครสมาชิก';
    }
  }

  // Setup Dashboard
  function setupDashboard() {
    const u = state.user;
    $('sidebar-avatar').src = u.avatar_url || avatarFallback(u.username);
    $('sidebar-username').textContent = u.username;
    $('sidebar-role').textContent = u.role === 'admin' ? '👑 แอดมิน' : '⚔️ สมาชิก';
    $('sidebar-role').className = `role-badge ${u.role}`;
    if (u.role === 'admin') {
      document.querySelectorAll('#system-roster .admin-only').forEach(el => el.classList.remove('hidden'));
    }
    document.querySelectorAll('#system-roster .nav-item').forEach(item => {
      item.addEventListener('click', () => showPage(item.dataset.page));
    });
  }

  // Logout
  $('btn-logout').addEventListener('click', async () => {
    try { await api('POST', '/api/roster/logout'); } catch { /* ok */ }
    state.token = ''; state.user = null;
    localStorage.removeItem('roster-token');
    document.querySelectorAll('#system-roster .admin-only').forEach(el => el.classList.add('hidden'));
    showScreen('auth');
    $('login-username').value = ''; $('login-password').value = '';
  });

  // Sessions
  $('btn-refresh-sessions').addEventListener('click', loadSessions);
  async function loadSessions() {
    const list = $('sessions-list');
    list.innerHTML = '<div class="loading-state">⏳ กำลังโหลด...</div>';
    try {
      const [sessRes, attRes] = await Promise.all([
        api('GET', '/api/roster/sessions'),
        api('GET', '/api/roster/attendance/me')
      ]);
      const sessions = sessRes.data;
      const myMap    = new Map(attRes.data.map(r => [r.session_id, r]));
      if (sessions.length === 0) { list.innerHTML = '<div class="empty-state">📭 ยังไม่มีเซสชันเช็คกำลังพล</div>'; return; }
      list.innerHTML = sessions.map(s => {
        const myRecord = myMap.get(s.id);
        const isOpen   = s.status === 'open';
        const ts       = fmtDate(s.created_at);
        let action = '';
        if (!isOpen) {
          action = '<span class="badge badge-closed">🔴 เซสชันปิดแล้ว</span>';
        } else if (myRecord?.checked_out_at) {
          action = '<span class="badge badge-done">✅ เช็คชื่อแล้ว (ออกแล้ว)</span>';
        } else if (myRecord) {
          const inT = fmtTime(myRecord.checked_in_at);
          action = `<div class="session-actions"><span class="badge badge-in">✅ เช็คชื่อแล้ว ${h(inT)}</span><button class="btn-checkout" data-id="${h(s.id)}">🔴 เช็คเอาท์</button></div>`;
        } else {
          action = `<button class="btn-checkin" data-id="${h(s.id)}">📋 เช็คชื่อ</button>`;
        }
        return `<div class="session-card ${isOpen ? 'open' : 'closed'}">
          <div class="session-header"><h3>${h(s.title)}</h3><span class="status-badge ${isOpen ? 'open' : 'closed'}">${isOpen ? '🟢 เปิด' : '🔴 ปิด'}</span></div>
          ${s.description ? `<p class="session-desc">${h(s.description)}</p>` : ''}
          <div class="session-meta">📢 ประกาศโดย ${h(s.created_by)} • ${ts}</div>
          <div class="session-footer">${action}</div>
        </div>`;
      }).join('');
      list.querySelectorAll('.btn-checkin').forEach(btn => btn.addEventListener('click', () => doCheckin(btn.dataset.id, btn)));
      list.querySelectorAll('.btn-checkout').forEach(btn => btn.addEventListener('click', () => doCheckout(btn.dataset.id, btn)));
    } catch (err) {
      list.innerHTML = `<div class="error-state">❌ ${h(err.message)}</div>`;
    }
  }

  async function doCheckin(sessionId, btn) {
    btn.disabled = true; btn.textContent = '⏳...';
    try { await api('POST', `/api/roster/sessions/${sessionId}/checkin`, {}); toast('✅ เช็คชื่อสำเร็จ!', 'success'); loadSessions(); }
    catch (err) { toast('❌ ' + err.message, 'error'); btn.disabled = false; btn.textContent = '📋 เช็คชื่อ'; }
  }
  async function doCheckout(sessionId, btn) {
    btn.disabled = true; btn.textContent = '⏳...';
    try { await api('PATCH', `/api/roster/sessions/${sessionId}/checkout`); toast('🔴 เช็คเอาท์สำเร็จ', 'info'); loadSessions(); }
    catch (err) { toast('❌ ' + err.message, 'error'); btn.disabled = false; btn.textContent = '🔴 เช็คเอาท์'; }
  }

  // History
  async function loadHistory() {
    const list = $('history-list');
    list.innerHTML = '<div class="loading-state">⏳ กำลังโหลด...</div>';
    try {
      const res = await api('GET', '/api/roster/attendance/me');
      if (res.data.length === 0) { list.innerHTML = '<div class="empty-state">📭 ยังไม่มีประวัติ</div>'; return; }
      list.innerHTML = `<div class="history-list">${res.data.map(r => {
        let duration = '';
        if (r.checked_out_at) {
          const mins = Math.round((new Date(r.checked_out_at) - new Date(r.checked_in_at)) / 60000);
          duration = mins >= 60 ? `${Math.floor(mins/60)} ชม. ${mins%60} นาที` : `${mins} นาที`;
        }
        return `<div class="history-card">
          <div class="history-title">${h(r.session_title || 'N/A')}</div>
          <div class="history-row"><span>เข้า</span><span>${fmtDate(r.checked_in_at)}</span></div>
          <div class="history-row"><span>ออก</span><span>${r.checked_out_at ? fmtDate(r.checked_out_at) : '—'}</span></div>
          ${duration ? `<div class="history-row"><span>ระยะเวลา</span><span>${duration}</span></div>` : ''}
        </div>`;
      }).join('')}</div>`;
    } catch (err) { list.innerHTML = `<div class="error-state">❌ ${h(err.message)}</div>`; }
  }

  // Profile
  function loadProfile() {
    const u = state.user;
    $('profile-avatar-img').src = u.avatar_url || avatarFallback(u.username);
    $('profile-username').textContent = u.username;
    $('profile-roblox').textContent   = u.roblox_name;
    $('profile-discord').textContent  = u.discord_tag || '—';
    $('profile-role').textContent     = u.role === 'admin' ? '👑 แอดมิน' : '⚔️ สมาชิก';
  }
  $('btn-change-avatar').addEventListener('click', () => $('profile-avatar-file').click());
  $('profile-avatar-file').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    const status = $('profile-status');
    status.textContent = '⏳ กำลังตรวจสอบรูปภาพ...'; status.className = 'status-text';
    try {
      const compressed = await compressImage(file);
      status.textContent = '⏳ กำลังอัปโหลด...';
      const res = await api('PATCH', '/api/roster/me/avatar', { avatar_base64: compressed.base64, avatar_mime: compressed.mime });
      state.user.avatar_url = res.avatar_url;
      $('profile-avatar-img').src = res.avatar_url; $('sidebar-avatar').src = res.avatar_url;
      status.textContent = '✅ อัปเดตรูปโปรไฟล์สำเร็จ'; status.className = 'status-text success';
    } catch (err) { status.textContent = '❌ ' + err.message; status.className = 'status-text error'; }
    e.target.value = '';
  });

  // Admin: Sessions
  $('btn-refresh-admin-sessions').addEventListener('click', adminLoadSessions);
  $('btn-create-session').addEventListener('click', async () => {
    const title = $('new-session-title').value.trim();
    const desc  = $('new-session-desc').value.trim();
    const status = $('create-session-status');
    if (!title) { status.textContent = '❌ กรุณาใส่หัวข้อ'; status.className = 'status-text error'; return; }
    const btn = $('btn-create-session');
    btn.disabled = true; btn.textContent = '⏳ กำลังสร้าง...'; status.textContent = '';
    try {
      await api('POST', '/api/roster/sessions', { title, description: desc });
      status.textContent = `✅ สร้างเซสชัน "${title}" สำเร็จ`; status.className = 'status-text success';
      $('new-session-title').value = ''; $('new-session-desc').value = '';
      adminLoadSessions();
    } catch (err) { status.textContent = '❌ ' + err.message; status.className = 'status-text error'; }
    finally { btn.disabled = false; btn.textContent = '📢 ประกาศ'; }
  });

  async function adminLoadSessions() {
    const list = $('admin-sessions-list');
    list.innerHTML = '<div class="loading-state">⏳ กำลังโหลด...</div>';
    try {
      const res = await api('GET', '/api/roster/sessions');
      if (res.data.length === 0) { list.innerHTML = '<div class="empty-state">📭 ยังไม่มีเซสชัน</div>'; return; }
      list.innerHTML = res.data.map(s => {
        const isOpen = s.status === 'open';
        return `<div class="admin-session-row">
          <div><strong>${h(s.title)}</strong><div class="text-muted" style="font-size:12px;margin-top:2px">${fmtDate(s.created_at)} • โดย ${h(s.created_by)}</div>${s.description ? `<div class="text-muted" style="font-size:12px">${h(s.description)}</div>` : ''}</div>
          <div class="admin-session-actions">
            <span class="status-badge ${isOpen ? 'open' : 'closed'}">${isOpen ? '🟢 เปิด' : '🔴 ปิด'}</span>
            <button class="btn btn-secondary btn-sm" onclick="Roster.viewAttendees('${h(s.id)}','${h(s.title)}')">👁️ ดูผู้เข้าร่วม</button>
            ${isOpen ? `<button class="btn btn-danger btn-sm" onclick="Roster.closeSession('${h(s.id)}')">🔒 ปิด</button>` : ''}
          </div>
        </div>`;
      }).join('');
    } catch (err) { list.innerHTML = `<div class="error-state">❌ ${h(err.message)}</div>`; }
  }

  async function closeSession(id) {
    if (!confirm('ปิดเซสชันนี้?')) return;
    try { await api('PATCH', `/api/roster/sessions/${id}/close`); toast('🔒 ปิดเซสชันแล้ว', 'info'); adminLoadSessions(); }
    catch (err) { toast('❌ ' + err.message, 'error'); }
  }

  async function viewAttendees(sessionId, title) {
    $('modal-session-title').textContent = `👥 ผู้เข้าร่วม — ${title}`;
    $('modal-attendees-list').innerHTML = '<div class="loading-state">⏳ กำลังโหลด...</div>';
    $('modal-attendees').classList.remove('hidden');
    try {
      const res = await api('GET', `/api/roster/sessions/${sessionId}/attendees`);
      if (res.data.length === 0) { $('modal-attendees-list').innerHTML = '<div class="empty-state">📭 ยังไม่มีใครเช็คชื่อ</div>'; return; }
      $('modal-attendees-list').innerHTML = `
        <div class="attendees-summary">ทั้งหมด ${res.data.length} คน</div>
        <table class="data-table"><thead><tr><th>#</th><th>Username</th><th>Roblox</th><th>เวลาเข้า</th><th>เวลาออก</th></tr></thead>
        <tbody>${res.data.map((a,i) => `<tr><td>${i+1}</td><td>${h(a.username)}</td><td>${h(a.roblox_name)}</td><td>${fmtTime(a.checked_in_at)}</td><td>${a.checked_out_at ? fmtTime(a.checked_out_at) : '—'}</td></tr>`).join('')}</tbody></table>`;
    } catch (err) { $('modal-attendees-list').innerHTML = `<div class="error-state">❌ ${h(err.message)}</div>`; }
  }

  $('modal-close').addEventListener('click', () => $('modal-attendees').classList.add('hidden'));
  $('modal-attendees').addEventListener('click', e => { if (e.target === $('modal-attendees')) $('modal-attendees').classList.add('hidden'); });

  // Admin: Users
  $('btn-refresh-users').addEventListener('click', adminLoadUsers);
  async function adminLoadUsers() {
    const tbody = $('admin-users-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-state">⏳ กำลังโหลด...</td></tr>';
    try {
      const res = await api('GET', '/api/roster/users');
      if (res.data.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="empty-state">📭 ยังไม่มีสมาชิก</td></tr>'; return; }
      tbody.innerHTML = res.data.map(u => {
        const isMe   = u.id === state.user.id;
        const avSrc  = u.avatar_url || avatarFallback(u.username);
        const joined = u.created_at ? new Date(u.created_at).toLocaleDateString('th-TH') : '—';
        return `<tr>
          <td><img src="${h(avSrc)}" class="avatar-xs" onerror="this.src='${h(avatarFallback(u.username))}'"></td>
          <td><strong>${h(u.username)}</strong></td><td>${h(u.roblox_name)}</td><td>${h(u.discord_tag||'—')}</td>
          <td><span class="role-badge ${h(u.role)}">${u.role==='admin'?'👑 แอดมิน':'⚔️ สมาชิก'}</span></td>
          <td class="text-muted">${joined}</td>
          <td>${isMe ? '<span class="text-muted">(คุณ)</span>' :
            `<button class="btn btn-secondary btn-xs" onclick="Roster.toggleRole('${h(u.id)}','${h(u.role)}')">เปลี่ยน Role</button>
             <button class="btn btn-danger btn-xs" onclick="Roster.deleteUser('${h(u.id)}','${h(u.username)}')">ลบ</button>`
          }</td>
        </tr>`;
      }).join('');
    } catch (err) { tbody.innerHTML = `<tr><td colspan="7" class="error-state">❌ ${h(err.message)}</td></tr>`; }
  }

  async function toggleRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    if (!confirm(`เปลี่ยน role เป็น "${newRole}"?`)) return;
    try { await api('PATCH', `/api/roster/users/${userId}/role`, { role: newRole }); toast(`✅ เปลี่ยน role เป็น ${newRole} แล้ว`, 'success'); adminLoadUsers(); }
    catch (err) { toast('❌ ' + err.message, 'error'); }
  }

  async function deleteUser(userId, username) {
    if (!confirm(`ลบสมาชิก "${username}"?`)) return;
    try { await api('DELETE', `/api/roster/users/${userId}`); toast(`🗑️ ลบ ${username} แล้ว`, 'info'); adminLoadUsers(); }
    catch (err) { toast('❌ ' + err.message, 'error'); }
  }

  // Auto-init if token exists (prep state before user clicks)
  if (state.token) {
    api('GET', '/api/roster/me').then(data => {
      state.user = data.user;
    }).catch(() => {
      localStorage.removeItem('roster-token');
      state.token = '';
    });
  }

  return { init, closeSession, viewAttendees, toggleRole, deleteUser };
})();

// Activate roster when user clicks launcher
document.getElementById('btn-go-roster').addEventListener('click', () => Roster.init(), { once: false });

// ══════════════════════════════════════════
// BOT DASHBOARD APP
// ══════════════════════════════════════════
const BotDash = (function () {
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(`#system-botdash ${sel}`);

  let config = { mintUrl: '', nakhonsiUrl: '', mintKey: '', nakhonsiKey: '' };
  let activeBot = 'mint';
  let guildsCache = { mint: [], nakhonsi: [] };

  function getUrl() { return activeBot === 'mint' ? config.mintUrl : config.nakhonsiUrl; }
  function getKey() { return activeBot === 'mint' ? config.mintKey : config.nakhonsiKey; }

  async function api(path, options = {}) {
    const url = getUrl();
    if (!url) throw new Error('Bot URL not configured');
    const res = await fetch(`${url.replace(/\/$/, '')}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'x-api-key': getKey(), ...(options.headers || {}) }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  function toast(msg, type = 'info') {
    const el = $('bd-toast');
    el.textContent = msg; el.className = `toast ${type}`;
    el.classList.remove('hidden');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 3000);
  }

  function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h} ชม. ${m} นาที`;
  }

  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str; return div.innerHTML;
  }

  const NAKHONSI_URL = 'https://nongmai-production.up.railway.app';

  function loadSavedConfig() {
    // Pre-fill NakhonSi URL
    $('bd-nakhonsi-url').value = NAKHONSI_URL;
    try {
      const saved = localStorage.getItem('bot-dashboard-config');
      if (saved) {
        const parsed = JSON.parse(saved);
        $('bd-mint-url').value     = parsed.mintUrl || '';
        $('bd-nakhonsi-url').value = parsed.nakhonsiUrl || NAKHONSI_URL;
        $('bd-mint-key').value     = parsed.mintKey || '';
        $('bd-nakhonsi-key').value = parsed.nakhonsiKey || '';
        $('bd-save-config').checked = true;
      }
    } catch (e) {}
  }

  function showBdScreen(name) {
    $('bd-login').classList.toggle('hidden', name !== 'login');
    $('bd-dashboard').classList.toggle('hidden', name !== 'dashboard');
  }

  function showBdPage(page) {
    ['status','points','leaderboard','send-msg','settings'].forEach(p => {
      $(`bd-page-${p}`).classList.toggle('hidden', p !== page);
    });
    $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
  }

  // Navigation
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      showBdPage(page);
      if (['points','leaderboard','send-msg','settings'].includes(page)) loadGuilds();
    });
  });

  // Bot tabs
  $$('.bot-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.bot-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      switchBot(tab.dataset.bot);
    });
  });

  function switchBot(bot) {
    activeBot = bot;
    const manageSection = $('bd-manage-section');
    if (manageSection) manageSection.style.display = bot === 'nakhonsi' ? 'block' : 'none';
    loadGuilds();
  }

  // Connect
  $('bd-btn-connect').addEventListener('click', async () => {
    const mintUrl     = $('bd-mint-url').value.trim();
    const nakhonsiUrl = $('bd-nakhonsi-url').value.trim();
    const mintKey     = $('bd-mint-key').value.trim();
    const nakhonsiKey = $('bd-nakhonsi-key').value.trim();
    if (!mintUrl && !nakhonsiUrl) { $('bd-login-error').textContent = 'กรุณาใส่ URL อย่างน้อย 1 บอท'; return; }
    config = { mintUrl, nakhonsiUrl, mintKey, nakhonsiKey };
    if ($('bd-save-config').checked) { localStorage.setItem('bot-dashboard-config', JSON.stringify(config)); }
    else { localStorage.removeItem('bot-dashboard-config'); }
    showBdScreen('dashboard');
    if (!mintUrl && nakhonsiUrl) switchBot('nakhonsi'); else switchBot('mint');
    refreshStatus();
  });

  $('bd-btn-logout').addEventListener('click', () => {
    showBdScreen('login');
    config = { mintUrl:'', nakhonsiUrl:'', mintKey:'', nakhonsiKey:'' };
  });
  $('bd-btn-back-home').addEventListener('click', e => { e.preventDefault(); goHome(); });
  $('bd-btn-home').addEventListener('click', () => goHome());

  // Status
  async function checkBotHealth(type) {
    const url = type === 'mint' ? config.mintUrl : config.nakhonsiUrl;
    const key = type === 'mint' ? config.mintKey : config.nakhonsiKey;
    const dotEl  = $(`bd-${type}-dot`);
    const textEl = $(`bd-${type}-text`);
    const detEl  = $(`bd-${type}-details`);
    if (!url) { dotEl.textContent = '⚫'; textEl.textContent = 'ไม่ได้ตั้งค่า'; detEl.innerHTML = ''; return; }
    dotEl.textContent = '⏳'; textEl.textContent = 'กำลังตรวจสอบ...';
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/api/health`, { headers: { 'x-api-key': key } });
      const data = await res.json();
      if (data.status === 'online') {
        dotEl.textContent = '🟢'; textEl.textContent = 'ออนไลน์';
        detEl.innerHTML = `<p>🤖 ${data.bot?.tag || 'N/A'}</p><p>📌 เซิร์ฟเวอร์: ${data.guilds}</p><p>⏱️ Uptime: ${formatUptime(data.uptime)}</p>`;
      } else { dotEl.textContent = '🟡'; textEl.textContent = 'ผิดปกติ'; }
    } catch {
      dotEl.textContent = '🔴'; textEl.textContent = 'ออฟไลน์'; detEl.innerHTML = '';
    }
  }

  async function refreshStatus() {
    await Promise.all([checkBotHealth('mint'), checkBotHealth('nakhonsi')]);
  }
  $('bd-btn-refresh-status').addEventListener('click', refreshStatus);

  // Guilds
  async function loadGuilds() {
    try {
      const data = await api('/api/guilds');
      guildsCache[activeBot] = data.data || [];
      populateGuildSelects(guildsCache[activeBot]);
    } catch { /* silent */ }
  }

  function populateGuildSelects(guilds) {
    const selects = ['bd-guild-select-points','bd-guild-select-lb','bd-guild-select-msg','bd-guild-select-clear'];
    selects.forEach(id => {
      const el = $(id); if (!el) return;
      const current = el.value;
      el.innerHTML = '<option value="">เลือกเซิร์ฟเวอร์...</option>';
      guilds.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id; opt.textContent = `${g.name} (${g.memberCount} สมาชิก)`; el.appendChild(opt);
      });
      if (current) el.value = current;
    });
  }

  // Points
  $('bd-btn-load-points').addEventListener('click', async () => {
    const guildId = $('bd-guild-select-points').value;
    if (!guildId) return toast('เลือกเซิร์ฟเวอร์ก่อน', 'error');
    try {
      const data = await api(`/api/points/${guildId}`);
      const tbody = $('bd-points-tbody');
      tbody.innerHTML = '';
      if (!data.data || data.data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">ไม่มีข้อมูล</td></tr>'; return; }
      data.data.forEach((r, i) => {
        const name = r.user_name || r.roblox_name || '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i+1}</td><td><strong>${esc(name)}</strong></td><td>${esc(r.discord_name||'-')}</td><td><strong>${(r.total_points||0).toLocaleString()}</strong></td><td>${r.entry_count||0}</td>`;
        tbody.appendChild(tr);
      });
      toast(`โหลดข้อมูล ${data.data.length} คน`, 'success');
    } catch (err) { toast(err.message, 'error'); }
  });

  $('bd-btn-search-user').addEventListener('click', async () => {
    const guildId  = $('bd-guild-select-points').value;
    const userName = $('bd-search-user').value.trim();
    if (!guildId) return toast('เลือกเซิร์ฟเวอร์ก่อน', 'error');
    if (!userName) return toast('ใส่ชื่อผู้ใช้', 'error');
    try {
      const data = await api(`/api/points/${guildId}/user/${encodeURIComponent(userName)}`);
      const container = $('bd-user-detail-result');
      if (!data.data?.total) { container.innerHTML = '<p class="text-muted">ไม่พบข้อมูลผู้ใช้นี้</p>'; return; }
      const u = data.data.total;
      const entries = data.data.entries || [];
      const name = u.user_name || u.roblox_name || '-';
      let html = `<div class="user-detail-card"><h4>${esc(name)}</h4><div class="user-stat"><div class="label">แต้มรวม</div><div class="value" style="color:var(--yellow)">${(u.total_points||0).toLocaleString()}</div></div><div class="user-stat"><div class="label">จำนวนรายการ</div><div class="value">${u.entry_count||0}</div></div>`;
      if (entries.length > 0) {
        html += '<div class="section-divider"></div><p class="text-muted">รายการล่าสุด:</p><ul style="margin-top:8px;padding-left:20px">';
        entries.slice(0,10).forEach(e => {
          const pts = e.amount ?? e.points ?? 0;
          html += `<li style="margin-bottom:4px"><strong>${pts.toLocaleString()}</strong> ${e.activity ? '— '+esc(e.activity) : ''} <span class="text-muted">${e.created_at ? new Date(e.created_at).toLocaleDateString('th-TH') : ''}</span></li>`;
        });
        html += '</ul>';
      }
      html += '</div>';
      container.innerHTML = html;
    } catch (err) { toast(err.message, 'error'); }
  });

  $('bd-btn-add-points').addEventListener('click', async () => {
    const guildId    = $('bd-guild-select-points').value;
    const roblox_name= $('bd-manage-user').value.trim();
    const points     = parseInt($('bd-manage-amount').value);
    const activity   = $('bd-manage-reason').value.trim();
    if (!guildId || !roblox_name || !points) return toast('กรอกข้อมูลให้ครบ', 'error');
    try {
      const data = await api(`/api/points/${guildId}/add`, { method:'POST', body: JSON.stringify({ roblox_name, points, activity }) });
      $('bd-manage-result').textContent = `✅ ${data.message}`; $('bd-manage-result').className = 'result-text success';
      toast('เพิ่มแต้มสำเร็จ', 'success');
    } catch (err) { $('bd-manage-result').textContent = `❌ ${err.message}`; $('bd-manage-result').className = 'result-text error'; }
  });

  $('bd-btn-remove-points').addEventListener('click', async () => {
    const guildId    = $('bd-guild-select-points').value;
    const roblox_name= $('bd-manage-user').value.trim();
    const points     = parseInt($('bd-manage-amount').value);
    const reason     = $('bd-manage-reason').value.trim();
    if (!guildId || !roblox_name || !points) return toast('กรอกข้อมูลให้ครบ', 'error');
    try {
      const data = await api(`/api/points/${guildId}/remove`, { method:'POST', body: JSON.stringify({ roblox_name, points, reason }) });
      $('bd-manage-result').textContent = `✅ ${data.message}`; $('bd-manage-result').className = 'result-text success';
      toast('ลดแต้มสำเร็จ', 'success');
    } catch (err) { $('bd-manage-result').textContent = `❌ ${err.message}`; $('bd-manage-result').className = 'result-text error'; }
  });

  // Leaderboard
  $('bd-btn-load-lb').addEventListener('click', async () => {
    const guildId = $('bd-guild-select-lb').value;
    const limit   = parseInt($('bd-lb-limit').value) || 20;
    if (!guildId) return toast('เลือกเซิร์ฟเวอร์ก่อน', 'error');
    try {
      const data = await api(`/api/leaderboard/${guildId}?limit=${limit}`);
      const container = $('bd-leaderboard-content');
      if (!data.data || data.data.length === 0) { container.innerHTML = '<p class="text-muted">ยังไม่มีข้อมูล</p>'; return; }
      const medals = ['🥇','🥈','🥉'];
      container.innerHTML = data.data.map((r,i) => {
        const name = r.user_name || r.roblox_name || '-';
        const rankClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
        const rankText  = i<3?medals[i]:`${i+1}`;
        const pts = (r.total_points||0).toLocaleString();
        return `<div class="lb-item"><div class="lb-rank ${rankClass}">${rankText}</div><div class="lb-info"><div class="lb-name">${esc(name)}</div><div class="lb-sub">${r.entry_count} ผลงาน</div></div><div class="lb-points">${pts}</div></div>`;
      }).join('');
      toast(`โหลดอันดับ ${data.data.length} คน`, 'success');
    } catch (err) { toast(err.message, 'error'); }
  });

  // Send Message
  $('bd-guild-select-msg').addEventListener('change', async () => {
    const guildId = $('bd-guild-select-msg').value;
    const channelSelect = $('bd-channel-select');
    if (!guildId) { channelSelect.innerHTML = '<option value="">เลือกช่อง...</option>'; return; }
    channelSelect.innerHTML = '<option value="">กำลังโหลด...</option>';
    try {
      const data = await api(`/api/guilds/${guildId}/channels`);
      channelSelect.innerHTML = '<option value="">เลือกช่อง...</option>';
      (data.data || []).forEach(c => {
        const opt = document.createElement('option'); opt.value = c.id; opt.textContent = `#${c.name}`; channelSelect.appendChild(opt);
      });
    } catch { channelSelect.innerHTML = '<option value="">โหลดไม่สำเร็จ</option>'; }
  });

  $('bd-btn-send-msg').addEventListener('click', async () => {
    const channelId = $('bd-channel-select').value;
    const message   = $('bd-msg-content').value.trim();
    if (!channelId || !message) return toast('เลือกช่องและพิมพ์ข้อความ', 'error');
    try {
      await api('/api/send-message', { method:'POST', body: JSON.stringify({ channelId, message }) });
      $('bd-send-result').textContent = '✅ ส่งข้อความสำเร็จ!'; $('bd-send-result').className = 'result-text success';
      $('bd-msg-content').value = ''; toast('ส่งข้อความสำเร็จ', 'success');
    } catch (err) { $('bd-send-result').textContent = `❌ ${err.message}`; $('bd-send-result').className = 'result-text error'; }
  });

  // Clear Points
  $('bd-btn-clear-points').addEventListener('click', async () => {
    const guildId = $('bd-guild-select-clear').value;
    if (!guildId) return toast('เลือกเซิร์ฟเวอร์ก่อน', 'error');
    if (!confirm('⚠️ ล้างแต้มทั้งหมด? ไม่สามารถย้อนกลับได้!')) return;
    try {
      await api(`/api/points/${guildId}`, { method:'DELETE' });
      $('bd-clear-result').textContent = '✅ ล้างแต้มสำเร็จ!'; $('bd-clear-result').className = 'result-text success';
      toast('ล้างแต้มทั้งหมดเรียบร้อย', 'success');
    } catch (err) { $('bd-clear-result').textContent = `❌ ${err.message}`; $('bd-clear-result').className = 'result-text error'; }
  });

  return { loadSavedConfig };
})();