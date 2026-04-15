// app.js — Bot Dashboard frontend logic

// ============ State ============
let config = { mintUrl: '', nakhonsiUrl: '', mintKey: '', nakhonsiKey: '' };
let activeBot = 'mint'; // 'mint' | 'nakhonsi'
let guildsCache = { mint: [], nakhonsi: [] };

// ============ Helpers ============
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function getUrl() {
  return activeBot === 'mint' ? config.mintUrl : config.nakhonsiUrl;
}
function getKey() {
  return activeBot === 'mint' ? config.mintKey : config.nakhonsiKey;
}

async function api(path, options = {}) {
  const url = getUrl();
  if (!url) throw new Error('Bot URL not configured');
  const res = await fetch(`${url.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getKey(),
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function showToast(msg, type = 'info') {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} ชม. ${m} นาที`;
}

// ============ Login ============
function loadSavedConfig() {
  try {
    const saved = localStorage.getItem('bot-dashboard-config');
    if (saved) {
      const parsed = JSON.parse(saved);
      $('#mint-url').value = parsed.mintUrl || '';
      $('#nakhonsi-url').value = parsed.nakhonsiUrl || '';
      $('#mint-key').value = parsed.mintKey || '';
      $('#nakhonsi-key').value = parsed.nakhonsiKey || '';
      $('#save-config').checked = true;
    }
  } catch (e) {}
}

$('#btn-connect').addEventListener('click', async () => {
  const mintUrl = $('#mint-url').value.trim();
  const nakhonsiUrl = $('#nakhonsi-url').value.trim();
  const mintKey = $('#mint-key').value.trim();
  const nakhonsiKey = $('#nakhonsi-key').value.trim();

  if (!mintUrl && !nakhonsiUrl) {
    $('#login-error').textContent = 'กรุณาใส่ URL อย่างน้อย 1 บอท';
    return;
  }

  config = { mintUrl, nakhonsiUrl, mintKey, nakhonsiKey };

  if ($('#save-config').checked) {
    localStorage.setItem('bot-dashboard-config', JSON.stringify(config));
  } else {
    localStorage.removeItem('bot-dashboard-config');
  }

  // Show dashboard
  $('#login-screen').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');

  // If only one bot configured, switch to it
  if (!mintUrl && nakhonsiUrl) switchBot('nakhonsi');
  else switchBot('mint');

  refreshStatus();
});

$('#btn-logout').addEventListener('click', () => {
  $('#dashboard').classList.add('hidden');
  $('#login-screen').classList.remove('hidden');
  config = { mintUrl: '', nakhonsiUrl: '', mintKey: '', nakhonsiKey: '' };
});

// ============ Navigation ============
$$('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    $$('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const page = item.dataset.page;
    $$('.page').forEach(p => p.classList.add('hidden'));
    $(`#page-${page}`).classList.remove('hidden');

    // Load guild list for pages that need it
    if (['points', 'leaderboard', 'send-msg', 'settings'].includes(page)) {
      loadGuilds();
    }
  });
});

// ============ Bot Tabs ============
$$('.bot-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    switchBot(tab.dataset.bot);
  });
});

function switchBot(bot) {
  activeBot = bot;
  $$('.bot-tab').forEach(t => t.classList.remove('active'));
  $(`.bot-tab[data-bot="${bot}"]`).classList.add('active');

  // Show/hide NakhonSi-only features
  const manageSection = $('#manage-points-section');
  if (manageSection) {
    manageSection.style.display = bot === 'nakhonsi' ? 'block' : 'none';
  }

  // Reload guilds for current bot
  loadGuilds();
}

// ============ Status ============
async function checkBotHealth(type) {
  const url = type === 'mint' ? config.mintUrl : config.nakhonsiUrl;
  const key = type === 'mint' ? config.mintKey : config.nakhonsiKey;
  const dotEl = $(`#${type}-status-dot`);
  const textEl = $(`#${type}-status-text`);
  const detailsEl = $(`#${type}-details`);

  if (!url) {
    dotEl.textContent = '⚫';
    textEl.textContent = 'ไม่ได้ตั้งค่า';
    detailsEl.innerHTML = '';
    return;
  }

  dotEl.textContent = '⏳';
  textEl.textContent = 'กำลังตรวจสอบ...';

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/health`, {
      headers: { 'x-api-key': key }
    });
    const data = await res.json();

    if (data.status === 'online') {
      dotEl.textContent = '🟢';
      textEl.textContent = 'ออนไลน์';
      detailsEl.innerHTML = `
        <p>🤖 ${data.bot?.tag || 'N/A'}</p>
        <p>📌 เซิร์ฟเวอร์: ${data.guilds}</p>
        <p>⏱️ Uptime: ${formatUptime(data.uptime)}</p>
      `;
    } else {
      dotEl.textContent = '🟡';
      textEl.textContent = 'ผิดปกติ';
    }
  } catch (err) {
    dotEl.textContent = '🔴';
    textEl.textContent = 'ออฟไลน์';
    detailsEl.innerHTML = `<p style="color:var(--red)">${err.message}</p>`;
  }
}

async function refreshStatus() {
  await Promise.all([
    checkBotHealth('mint'),
    checkBotHealth('nakhonsi')
  ]);
}

$('#btn-refresh-status').addEventListener('click', refreshStatus);

// ============ Guilds ============
async function loadGuilds() {
  try {
    const data = await api('/api/guilds');
    guildsCache[activeBot] = data.data || [];
    populateGuildSelects(guildsCache[activeBot]);
  } catch (err) {
    // silent fail
  }
}

function populateGuildSelects(guilds) {
  const selects = ['#guild-select-points', '#guild-select-lb', '#guild-select-msg', '#guild-select-clear'];
  selects.forEach(sel => {
    const el = $(sel);
    if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="">เลือกเซิร์ฟเวอร์...</option>';
    guilds.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.name} (${g.memberCount} สมาชิก)`;
      el.appendChild(opt);
    });
    if (current) el.value = current;
  });
}

// ============ Points ============
$('#btn-load-points').addEventListener('click', async () => {
  const guildId = $('#guild-select-points').value;
  if (!guildId) return showToast('เลือกเซิร์ฟเวอร์ก่อน', 'error');

  try {
    const data = await api(`/api/points/${guildId}`);
    const tbody = $('#points-tbody');
    tbody.innerHTML = '';

    if (!data.data || data.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">ไม่มีข้อมูล</td></tr>';
      return;
    }

    data.data.forEach((r, i) => {
      const name = r.user_name || r.roblox_name || '-';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><strong>${esc(name)}</strong></td>
        <td>${esc(r.discord_name || '-')}</td>
        <td><strong>${(r.total_points || 0).toLocaleString()}</strong></td>
        <td>${r.entry_count || 0}</td>
      `;
      tbody.appendChild(tr);
    });

    showToast(`โหลดข้อมูล ${data.data.length} คน`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ============ Search User ============
$('#btn-search-user').addEventListener('click', async () => {
  const guildId = $('#guild-select-points').value;
  const userName = $('#search-user').value.trim();
  if (!guildId) return showToast('เลือกเซิร์ฟเวอร์ก่อน', 'error');
  if (!userName) return showToast('ใส่ชื่อผู้ใช้', 'error');

  try {
    const data = await api(`/api/points/${guildId}/user/${encodeURIComponent(userName)}`);
    const container = $('#user-detail-result');

    if (!data.data?.total) {
      container.innerHTML = '<p class="text-muted">ไม่พบข้อมูลผู้ใช้นี้</p>';
      return;
    }

    const u = data.data.total;
    const entries = data.data.entries || [];
    const name = u.user_name || u.roblox_name || '-';

    let html = `
      <div class="user-detail-card">
        <h4>${esc(name)}</h4>
        <div class="user-stat">
          <div class="label">แต้มรวม</div>
          <div class="value" style="color:var(--yellow)">${(u.total_points || 0).toLocaleString()}</div>
        </div>
        <div class="user-stat">
          <div class="label">จำนวนรายการ</div>
          <div class="value">${u.entry_count || 0}</div>
        </div>
        <div class="user-stat">
          <div class="label">Discord</div>
          <div class="value" style="font-size:14px">${esc(u.discord_name || '-')}</div>
        </div>
    `;

    if (entries.length > 0) {
      html += '<div class="section-divider"></div><p class="text-muted">รายการล่าสุด:</p><ul style="margin-top:8px;padding-left:20px">';
      entries.slice(0, 10).forEach(e => {
        const pts = e.amount ?? e.points ?? 0;
        const act = e.activity || '';
        const date = e.created_at ? new Date(e.created_at).toLocaleDateString('th-TH') : '';
        html += `<li style="margin-bottom:4px"><strong>${pts.toLocaleString()}</strong> ${act ? '— ' + esc(act) : ''} <span class="text-muted">${date}</span></li>`;
      });
      html += '</ul>';
    }

    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ============ Add/Remove Points ============
$('#btn-add-points').addEventListener('click', async () => {
  const guildId = $('#guild-select-points').value;
  const roblox_name = $('#manage-user').value.trim();
  const points = parseInt($('#manage-amount').value);
  const activity = $('#manage-reason').value.trim();

  if (!guildId || !roblox_name || !points) {
    return showToast('กรอกข้อมูลให้ครบ', 'error');
  }

  try {
    const data = await api(`/api/points/${guildId}/add`, {
      method: 'POST',
      body: JSON.stringify({ roblox_name, points, activity })
    });
    $('#manage-result').textContent = `✅ ${data.message}`;
    $('#manage-result').className = 'result-text success';
    showToast('เพิ่มแต้มสำเร็จ', 'success');
  } catch (err) {
    $('#manage-result').textContent = `❌ ${err.message}`;
    $('#manage-result').className = 'result-text error';
  }
});

$('#btn-remove-points').addEventListener('click', async () => {
  const guildId = $('#guild-select-points').value;
  const roblox_name = $('#manage-user').value.trim();
  const points = parseInt($('#manage-amount').value);
  const reason = $('#manage-reason').value.trim();

  if (!guildId || !roblox_name || !points) {
    return showToast('กรอกข้อมูลให้ครบ', 'error');
  }

  try {
    const data = await api(`/api/points/${guildId}/remove`, {
      method: 'POST',
      body: JSON.stringify({ roblox_name, points, reason })
    });
    $('#manage-result').textContent = `✅ ${data.message}`;
    $('#manage-result').className = 'result-text success';
    showToast('ลดแต้มสำเร็จ', 'success');
  } catch (err) {
    $('#manage-result').textContent = `❌ ${err.message}`;
    $('#manage-result').className = 'result-text error';
  }
});

// ============ Leaderboard ============
$('#btn-load-lb').addEventListener('click', async () => {
  const guildId = $('#guild-select-lb').value;
  const limit = parseInt($('#lb-limit').value) || 20;
  if (!guildId) return showToast('เลือกเซิร์ฟเวอร์ก่อน', 'error');

  try {
    const data = await api(`/api/leaderboard/${guildId}?limit=${limit}`);
    const container = $('#leaderboard-content');

    if (!data.data || data.data.length === 0) {
      container.innerHTML = '<p class="text-muted">ยังไม่มีข้อมูล</p>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    let html = '';
    data.data.forEach((r, i) => {
      const name = r.user_name || r.roblox_name || '-';
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      const rankText = i < 3 ? medals[i] : `${i + 1}`;
      const pts = (r.total_points || 0).toLocaleString();
      const isMint = activeBot === 'mint';
      const subInfo = isMint
        ? `${r.rank_name || '-'} • ${r.entry_count} รายการ`
        : `${r.entry_count} ผลงาน`;

      html += `
        <div class="lb-item">
          <div class="lb-rank ${rankClass}">${rankText}</div>
          <div class="lb-info">
            <div class="lb-name">${esc(name)}</div>
            <div class="lb-sub">${esc(subInfo)}</div>
          </div>
          <div class="lb-points">${pts}</div>
        </div>
      `;
    });

    container.innerHTML = html;
    showToast(`โหลดอันดับ ${data.data.length} คน`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ============ Send Message ============
$('#guild-select-msg').addEventListener('change', async () => {
  const guildId = $('#guild-select-msg').value;
  const channelSelect = $('#channel-select');
  channelSelect.innerHTML = '<option value="">กำลังโหลด...</option>';

  if (!guildId) {
    channelSelect.innerHTML = '<option value="">เลือกช่อง...</option>';
    return;
  }

  try {
    const data = await api(`/api/guilds/${guildId}/channels`);
    channelSelect.innerHTML = '<option value="">เลือกช่อง...</option>';
    (data.data || []).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `#${c.name}`;
      channelSelect.appendChild(opt);
    });
  } catch (err) {
    channelSelect.innerHTML = '<option value="">โหลดไม่สำเร็จ</option>';
  }
});

$('#btn-send-msg').addEventListener('click', async () => {
  const channelId = $('#channel-select').value;
  const message = $('#msg-content').value.trim();
  if (!channelId || !message) return showToast('เลือกช่องและพิมพ์ข้อความ', 'error');

  try {
    await api('/api/send-message', {
      method: 'POST',
      body: JSON.stringify({ channelId, message })
    });
    $('#send-result').textContent = '✅ ส่งข้อความสำเร็จ!';
    $('#send-result').className = 'result-text success';
    $('#msg-content').value = '';
    showToast('ส่งข้อความสำเร็จ', 'success');
  } catch (err) {
    $('#send-result').textContent = `❌ ${err.message}`;
    $('#send-result').className = 'result-text error';
  }
});

// ============ Clear Points ============
$('#btn-clear-points').addEventListener('click', async () => {
  const guildId = $('#guild-select-clear').value;
  if (!guildId) return showToast('เลือกเซิร์ฟเวอร์ก่อน', 'error');

  if (!confirm('⚠️ คุณแน่ใจหรือไม่ว่าต้องการล้างแต้มทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้!')) return;

  try {
    await api(`/api/points/${guildId}`, { method: 'DELETE' });
    $('#clear-result').textContent = '✅ ล้างแต้มสำเร็จ!';
    $('#clear-result').className = 'result-text success';
    showToast('ล้างแต้มทั้งหมดเรียบร้อย', 'success');
  } catch (err) {
    $('#clear-result').textContent = `❌ ${err.message}`;
    $('#clear-result').className = 'result-text error';
  }
});

// ============ XSS protection ============
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============ Init ============
loadSavedConfig();
