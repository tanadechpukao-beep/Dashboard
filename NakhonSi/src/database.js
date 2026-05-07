// database.js - Cloud Firestore storage for points (นครศรีธรรมราช)
const admin = require('firebase-admin');

// ============ Initialize Firebase ============
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ กรุณาตั้งค่า FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey })
});

const db = admin.firestore();
const pointsCol = db.collection('points');
const scanCol = db.collection('scan_history');

console.log('✅ Firebase Firestore connected (NakhonSi)');

// ============ Query helpers ============

const insertPoint = {
  async run(params) {
    // Check duplicate by message_id
    if (params.message_id) {
      const dup = await pointsCol.where('message_id', '==', params.message_id).limit(1).get();
      if (!dup.empty) return;
    }
    await pointsCol.add({
      guild_id: params.guild_id,
      roblox_name: params.roblox_name,
      discord_name: params.discord_name || null,
      activity: params.activity || null,
      points: params.points,
      work_number: params.work_number || null,
      message_id: params.message_id || null,
      channel_id: params.channel_id || null,
      raw_message: params.raw_message || null,
      created_at: new Date().toISOString()
    });
  }
};

const getUserPoints = {
  async all(guildId) {
    const snap = await pointsCol.where('guild_id', '==', guildId).get();
    const map = new Map();
    snap.forEach(doc => {
      const p = doc.data();
      const key = (p.roblox_name || '').toLowerCase();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          roblox_name: p.roblox_name,
          discord_name: p.discord_name,
          total_points: 0,
          entry_count: 0
        });
      }
      const entry = map.get(key);
      entry.total_points += p.points;
      entry.entry_count++;
      if (p.discord_name) entry.discord_name = p.discord_name;
    });
    return [...map.values()].sort((a, b) => b.total_points - a.total_points);
  }
};

const getLeaderboard = {
  async all(guildId, limit) {
    const all = await getUserPoints.all(guildId);
    return all.slice(0, limit);
  }
};

const getSpecificUserPoints = {
  async all(guildId, userName) {
    const snap = await pointsCol.where('guild_id', '==', guildId).get();
    const uLower = userName.toLowerCase();
    const results = [];
    snap.forEach(doc => {
      const p = doc.data();
      if ((p.roblox_name || '').toLowerCase().includes(uLower) ||
          (p.discord_name || '').toLowerCase().includes(uLower)) {
        results.push(p);
      }
    });
    return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
};

const getSpecificUserTotal = {
  async all(guildId, userName) {
    const entries = await getSpecificUserPoints.all(guildId, userName);
    if (entries.length === 0) return [];
    const first = entries[0];
    return [{
      roblox_name: first.roblox_name,
      discord_name: first.discord_name,
      total_points: entries.reduce((sum, e) => sum + e.points, 0),
      entry_count: entries.length
    }];
  }
};

const messageExists = {
  async get(messageId) {
    const snap = await pointsCol.where('message_id', '==', messageId).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].data();
  }
};

const saveScanHistory = {
  async run(guildId, channelId, lastMessageId) {
    const docId = `${guildId}_${channelId}`;
    await scanCol.doc(docId).set({
      guild_id: guildId,
      channel_id: channelId,
      last_message_id: lastMessageId,
      scanned_at: new Date().toISOString()
    }, { merge: true });
  }
};

const getLastScanned = {
  async get(guildId, channelId) {
    const docId = `${guildId}_${channelId}`;
    const doc = await scanCol.doc(docId).get();
    return doc.exists ? doc.data() : null;
  }
};

const clearGuildPoints = {
  async run(guildId) {
    const snap = await pointsCol.where('guild_id', '==', guildId).get();
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
};

module.exports = {
  insertPoint,
  getUserPoints,
  getLeaderboard,
  getSpecificUserPoints,
  getSpecificUserTotal,
  messageExists,
  saveScanHistory,
  getLastScanned,
  clearGuildPoints
};
