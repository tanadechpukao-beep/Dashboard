// roster-db.js - Firestore helpers for roster/attendance web system
// NOTE: Firebase is already initialized in database.js — admin.firestore() is safe to call here
// because database.js is always imported before this module is used.
const admin = require('firebase-admin');

const COLL_USERS      = 'roster_users';
const COLL_TOKENS     = 'roster_tokens';
const COLL_SESSIONS   = 'roster_sessions';
const COLL_ATTENDANCE = 'roster_attendance';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function db() {
  return admin.firestore();
}

// ============ Users ============

async function createUser(data) {
  const ref = await db().collection(COLL_USERS).add(data);
  return ref.id;
}

async function getUserByUsername(username) {
  const snap = await db().collection(COLL_USERS)
    .where('username', '==', username.toLowerCase())
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function getUserById(id) {
  const doc = await db().collection(COLL_USERS).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function updateUserAvatar(userId, avatarUrl) {
  await db().collection(COLL_USERS).doc(userId).update({ avatar_url: avatarUrl });
}

async function updateUserRole(userId, role) {
  await db().collection(COLL_USERS).doc(userId).update({ role });
}

async function deleteUser(userId) {
  const fdb = db();
  await fdb.collection(COLL_USERS).doc(userId).delete();
  // Delete user's tokens
  const tokenSnap = await fdb.collection(COLL_TOKENS).where('user_id', '==', userId).get();
  if (!tokenSnap.empty) {
    const batch = fdb.batch();
    tokenSnap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

async function getAllUsers() {
  const snap = await db().collection(COLL_USERS).get();
  const users = snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      username: d.username,
      roblox_name: d.roblox_name,
      discord_tag: d.discord_tag,
      role: d.role,
      avatar_url: d.avatar_url,
      created_at: d.created_at
    };
  });
  // Sort by created_at descending (in memory to avoid Firestore index)
  return users.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

// ============ Tokens ============

async function createToken(userId, token) {
  await db().collection(COLL_TOKENS).doc(token).set({
    user_id: userId,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString()
  });
}

async function getUserByToken(token) {
  const tokenDoc = await db().collection(COLL_TOKENS).doc(token).get();
  if (!tokenDoc.exists) return null;
  const data = tokenDoc.data();
  if (new Date(data.expires_at) < new Date()) {
    await db().collection(COLL_TOKENS).doc(token).delete();
    return null;
  }
  return await getUserById(data.user_id);
}

async function deleteToken(token) {
  await db().collection(COLL_TOKENS).doc(token).delete();
}

// ============ Sessions ============

async function createSession(data) {
  const ref = await db().collection(COLL_SESSIONS).add(data);
  return ref.id;
}

async function getSession(id) {
  const doc = await db().collection(COLL_SESSIONS).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function getAllSessions() {
  const snap = await db().collection(COLL_SESSIONS).get();
  const sessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return sessions.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

async function getOpenSessions() {
  const snap = await db().collection(COLL_SESSIONS).where('status', '==', 'open').get();
  const sessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return sessions.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

async function closeSession(id) {
  await db().collection(COLL_SESSIONS).doc(id).update({
    status: 'closed',
    closed_at: new Date().toISOString()
  });
}

// ============ Attendance ============

async function createAttendanceRecord(data) {
  const ref = await db().collection(COLL_ATTENDANCE).add(data);
  return ref.id;
}

async function getAttendanceRecord(sessionId, userId) {
  // Single-field query on session_id, filter userId in memory
  const snap = await db().collection(COLL_ATTENDANCE)
    .where('session_id', '==', sessionId)
    .get();
  const doc = snap.docs.find(d => d.data().user_id === userId);
  if (!doc) return null;
  return { id: doc.id, ...doc.data() };
}

async function getSessionAttendees(sessionId) {
  const snap = await db().collection(COLL_ATTENDANCE)
    .where('session_id', '==', sessionId)
    .get();
  const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return records.sort((a, b) => new Date(a.checked_in_at || 0) - new Date(b.checked_in_at || 0));
}

async function getUserAttendance(userId) {
  const snap = await db().collection(COLL_ATTENDANCE)
    .where('user_id', '==', userId)
    .get();
  const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  records.sort((a, b) => new Date(b.checked_in_at || 0) - new Date(a.checked_in_at || 0));

  // Enrich with session title/status (batch fetch unique sessions)
  const sessionIds = [...new Set(records.map(r => r.session_id))];
  const sessionMap = new Map();
  for (const sid of sessionIds) {
    const s = await getSession(sid);
    if (s) sessionMap.set(sid, s);
  }

  return records.slice(0, 30).map(r => ({
    ...r,
    session_title: sessionMap.get(r.session_id)?.title || 'N/A',
    session_status: sessionMap.get(r.session_id)?.status || 'unknown'
  }));
}

async function checkOutRecord(recordId, timestamp) {
  await db().collection(COLL_ATTENDANCE).doc(recordId).update({
    checked_out_at: timestamp
  });
}

module.exports = {
  createUser,
  getUserByUsername,
  getUserById,
  updateUserAvatar,
  updateUserRole,
  deleteUser,
  getAllUsers,
  createToken,
  getUserByToken,
  deleteToken,
  createSession,
  getSession,
  getAllSessions,
  getOpenSessions,
  closeSession,
  createAttendanceRecord,
  getAttendanceRecord,
  getSessionAttendees,
  getUserAttendance,
  checkOutRecord
};
