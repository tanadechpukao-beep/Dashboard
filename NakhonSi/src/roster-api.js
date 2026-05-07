// roster-api.js - Web roster (attendance) system API routes
const crypto = require('crypto');
const rosterDb = require('./roster-db');
const { checkImage18Plus } = require('./image-check');

// Admins defined via env: ROSTER_ADMINS=username1,username2
const ROSTER_ADMINS = (process.env.ROSTER_ADMINS || '')
  .toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

const MAX_AVATAR_B64 = 200 * 1024; // 200KB base64 (~150KB actual)

// ── Password helpers ──────────────────────────────────────────────────────────
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── Middleware ────────────────────────────────────────────────────────────────
async function rosterAuth(req, res, next) {
  const token = req.headers['x-roster-token'];
  if (!token) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบก่อน' });
  const user = await rosterDb.getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  req.rosterUser = user;
  next();
}

function rosterAdmin(req, res, next) {
  const u = req.rosterUser;
  if (u.role !== 'admin' && !ROSTER_ADMINS.includes(u.username.toLowerCase())) {
    return res.status(403).json({ error: 'เฉพาะแอดมินเท่านั้น' });
  }
  next();
}

function safeUser(u) {
  return {
    id: u.id,
    username: u.username,
    roblox_name: u.roblox_name,
    discord_tag: u.discord_tag,
    role: u.role,
    avatar_url: u.avatar_url
  };
}

// ── Mount all roster routes ───────────────────────────────────────────────────
function mountRosterRoutes(app) {

  // ── Register ─────────────────────────────────────────────────────────────
  app.post('/api/roster/register', async (req, res) => {
    try {
      const { username, password, roblox_name, discord_tag, avatar_base64, avatar_mime } = req.body;

      if (!username || !password || !roblox_name) {
        return res.status(400).json({ error: 'กรุณากรอก username, password, roblox_name' });
      }
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        return res.status(400).json({ error: 'username ต้องเป็น a-z A-Z 0-9 _ ยาว 3-30 ตัว' });
      }
      if (password.length < 6 || password.length > 128) {
        return res.status(400).json({ error: 'password ต้องมีอย่างน้อย 6 ตัวอักษร' });
      }
      if (String(roblox_name).trim().length === 0 || roblox_name.length > 50) {
        return res.status(400).json({ error: 'roblox_name ไม่ถูกต้อง' });
      }

      const existing = await rosterDb.getUserByUsername(username.toLowerCase());
      if (existing) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });

      let avatarUrl = null;
      if (avatar_base64) {
        if (typeof avatar_base64 !== 'string' || avatar_base64.length > MAX_AVATAR_B64) {
          return res.status(400).json({ error: 'รูปภาพใหญ่เกินไป (สูงสุด ~150KB)' });
        }
        const aiResult = await checkImage18Plus(avatar_base64, avatar_mime || 'image/jpeg');
        if (aiResult.blocked) {
          return res.status(400).json({
            error: '🚫 รูปภาพไม่เหมาะสม AI ตรวจพบเนื้อหา 18+',
            reason: aiResult.reason
          });
        }
        avatarUrl = `data:${avatar_mime || 'image/jpeg'};base64,${avatar_base64}`;
      }

      const salt = generateSalt();
      const hash = hashPassword(password, salt);
      const role = ROSTER_ADMINS.includes(username.toLowerCase()) ? 'admin' : 'member';

      const userId = await rosterDb.createUser({
        username: username.toLowerCase(),
        password_hash: hash,
        password_salt: salt,
        roblox_name: String(roblox_name).trim(),
        discord_tag: discord_tag ? String(discord_tag).trim().substring(0, 50) : null,
        avatar_url: avatarUrl,
        role,
        created_at: new Date().toISOString()
      });

      const token = generateToken();
      await rosterDb.createToken(userId, token);

      res.json({
        success: true,
        token,
        user: { id: userId, username: username.toLowerCase(), roblox_name: String(roblox_name).trim(), role, avatar_url: avatarUrl }
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
  });

  // ── Login ─────────────────────────────────────────────────────────────────
  app.post('/api/roster/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'กรุณากรอก username และ password' });
      }
      const user = await rosterDb.getUserByUsername(username.toLowerCase());
      if (!user) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });

      const hash = hashPassword(password, user.password_salt);
      if (hash !== user.password_hash) {
        return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      }

      const token = generateToken();
      await rosterDb.createToken(user.id, token);
      res.json({ success: true, token, user: safeUser(user) });
    } catch (err) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  app.post('/api/roster/logout', rosterAuth, async (req, res) => {
    try {
      await rosterDb.deleteToken(req.headers['x-roster-token']);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Me ────────────────────────────────────────────────────────────────────
  app.get('/api/roster/me', rosterAuth, (req, res) => {
    res.json({ success: true, user: safeUser(req.rosterUser) });
  });

  // ── Update avatar ─────────────────────────────────────────────────────────
  app.patch('/api/roster/me/avatar', rosterAuth, async (req, res) => {
    try {
      const { avatar_base64, avatar_mime } = req.body;
      if (!avatar_base64) return res.status(400).json({ error: 'ไม่พบรูปภาพ' });
      if (typeof avatar_base64 !== 'string' || avatar_base64.length > MAX_AVATAR_B64) {
        return res.status(400).json({ error: 'รูปภาพใหญ่เกินไป' });
      }
      const aiResult = await checkImage18Plus(avatar_base64, avatar_mime || 'image/jpeg');
      if (aiResult.blocked) {
        return res.status(400).json({ error: '🚫 รูปภาพไม่เหมาะสม', reason: aiResult.reason });
      }
      const avatarUrl = `data:${avatar_mime || 'image/jpeg'};base64,${avatar_base64}`;
      await rosterDb.updateUserAvatar(req.rosterUser.id, avatarUrl);
      res.json({ success: true, avatar_url: avatarUrl });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Sessions: List ────────────────────────────────────────────────────────
  app.get('/api/roster/sessions', rosterAuth, async (req, res) => {
    try {
      const u = req.rosterUser;
      const isAdmin = u.role === 'admin' || ROSTER_ADMINS.includes(u.username.toLowerCase());
      const sessions = isAdmin ? await rosterDb.getAllSessions() : await rosterDb.getOpenSessions();
      res.json({ success: true, data: sessions });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Sessions: Create (admin) ──────────────────────────────────────────────
  app.post('/api/roster/sessions', rosterAuth, rosterAdmin, async (req, res) => {
    try {
      const { title, description } = req.body;
      if (!title || String(title).trim().length === 0) {
        return res.status(400).json({ error: 'กรุณาใส่หัวข้อ' });
      }
      if (String(title).length > 200) {
        return res.status(400).json({ error: 'หัวข้อยาวเกินไป' });
      }
      const sessionId = await rosterDb.createSession({
        title: String(title).trim(),
        description: description ? String(description).trim().substring(0, 500) : '',
        created_by: req.rosterUser.username,
        status: 'open',
        created_at: new Date().toISOString()
      });
      res.json({ success: true, id: sessionId, message: `สร้างเซสชัน "${String(title).trim()}" สำเร็จ` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Sessions: Close (admin) ───────────────────────────────────────────────
  app.patch('/api/roster/sessions/:id/close', rosterAuth, rosterAdmin, async (req, res) => {
    try {
      const session = await rosterDb.getSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'ไม่พบเซสชัน' });
      if (session.status === 'closed') return res.status(400).json({ error: 'เซสชันปิดอยู่แล้ว' });
      await rosterDb.closeSession(req.params.id);
      res.json({ success: true, message: 'ปิดเซสชันแล้ว' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Sessions: Attendees (admin) ───────────────────────────────────────────
  app.get('/api/roster/sessions/:id/attendees', rosterAuth, rosterAdmin, async (req, res) => {
    try {
      const session = await rosterDb.getSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'ไม่พบเซสชัน' });
      const attendees = await rosterDb.getSessionAttendees(req.params.id);
      res.json({ success: true, session, data: attendees });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Check-in ──────────────────────────────────────────────────────────────
  app.post('/api/roster/sessions/:id/checkin', rosterAuth, async (req, res) => {
    try {
      const session = await rosterDb.getSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'ไม่พบเซสชัน' });
      if (session.status !== 'open') {
        return res.status(400).json({ error: 'เซสชันนี้ปิดแล้ว ไม่สามารถเช็คชื่อได้' });
      }
      const existing = await rosterDb.getAttendanceRecord(req.params.id, req.rosterUser.id);
      if (existing) return res.status(409).json({ error: 'คุณเช็คชื่อในเซสชันนี้แล้ว' });

      await rosterDb.createAttendanceRecord({
        session_id: req.params.id,
        user_id: req.rosterUser.id,
        username: req.rosterUser.username,
        roblox_name: req.rosterUser.roblox_name,
        note: req.body.note ? String(req.body.note).substring(0, 200) : '',
        checked_in_at: new Date().toISOString(),
        checked_out_at: null
      });

      res.json({ success: true, message: `✅ เช็คชื่อสำเร็จ — ${session.title}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Check-out ─────────────────────────────────────────────────────────────
  app.patch('/api/roster/sessions/:id/checkout', rosterAuth, async (req, res) => {
    try {
      const record = await rosterDb.getAttendanceRecord(req.params.id, req.rosterUser.id);
      if (!record) return res.status(404).json({ error: 'คุณยังไม่ได้เช็คชื่อในเซสชันนี้' });
      if (record.checked_out_at) return res.status(409).json({ error: 'คุณเช็คเอาท์ไปแล้ว' });
      await rosterDb.checkOutRecord(record.id, new Date().toISOString());
      res.json({ success: true, message: '🔴 เช็คเอาท์สำเร็จ' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── My attendance history ─────────────────────────────────────────────────
  app.get('/api/roster/attendance/me', rosterAuth, async (req, res) => {
    try {
      const records = await rosterDb.getUserAttendance(req.rosterUser.id);
      res.json({ success: true, data: records });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: Users list ─────────────────────────────────────────────────────
  app.get('/api/roster/users', rosterAuth, rosterAdmin, async (req, res) => {
    try {
      const users = await rosterDb.getAllUsers();
      res.json({ success: true, data: users });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: Change role ────────────────────────────────────────────────────
  app.patch('/api/roster/users/:id/role', rosterAuth, rosterAdmin, async (req, res) => {
    try {
      const { role } = req.body;
      if (!['member', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'role ต้องเป็น member หรือ admin' });
      }
      if (req.params.id === req.rosterUser.id) {
        return res.status(400).json({ error: 'ไม่สามารถเปลี่ยน role ตัวเองได้' });
      }
      await rosterDb.updateUserRole(req.params.id, role);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: Delete user ────────────────────────────────────────────────────
  app.delete('/api/roster/users/:id', rosterAuth, rosterAdmin, async (req, res) => {
    try {
      if (req.params.id === req.rosterUser.id) {
        return res.status(400).json({ error: 'ไม่สามารถลบตัวเองได้' });
      }
      await rosterDb.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log('✅ Roster API routes mounted at /api/roster/*');

  // Seed admin account on startup
  seedAdmin().catch(err => console.error('Seed admin error:', err));
}

// ── Seed default admin ────────────────────────────────────────────────────────
async function seedAdmin() {
  const username = (process.env.SEED_ADMIN_USERNAME || 'tana').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'NakhonSi2569';
  const robloxName = process.env.SEED_ADMIN_ROBLOX || 'Tana';

  const existing = await rosterDb.getUserByUsername(username);
  if (existing) {
    console.log(`ℹ️  Seed admin "${username}" already exists`);
    return;
  }

  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  await rosterDb.createUser({
    username,
    password_hash: hash,
    password_salt: salt,
    roblox_name: robloxName,
    discord_tag: null,
    avatar_url: null,
    role: 'admin',
    created_at: new Date().toISOString()
  });
  console.log(`✅ Seed admin created — username: ${username} / password: ${password}`);
}

module.exports = { mountRosterRoutes };
