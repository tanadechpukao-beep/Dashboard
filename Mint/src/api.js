// api.js - Express API server for web dashboard (Mint)
const express = require('express');
const cors = require('cors');
const db = require('./database');

const API_KEY = process.env.WEB_API_KEY || 'change-me';
const PORT = process.env.PORT || 3000;

function startAPI(discordClient) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // ============ Auth middleware ============
  function auth(req, res, next) {
    const key = req.headers['x-api-key'];
    if (key !== API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }

  // ============ Public routes ============
  app.get('/api/health', (req, res) => {
    const botUser = discordClient.user;
    res.json({
      status: 'online',
      bot: botUser ? { tag: botUser.tag, id: botUser.id } : null,
      guilds: discordClient.guilds.cache.size,
      uptime: process.uptime(),
      type: 'mint'
    });
  });

  // ============ Protected routes ============

  // Get all points for a guild
  app.get('/api/points/:guildId', auth, async (req, res) => {
    try {
      const results = await db.getUserPoints.all(req.params.guildId);
      res.json({ success: true, data: results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get leaderboard
  app.get('/api/leaderboard/:guildId', auth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const results = await db.getLeaderboard.all(req.params.guildId, limit);
      res.json({ success: true, data: results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get specific user points
  app.get('/api/points/:guildId/user/:userName', auth, async (req, res) => {
    try {
      const total = await db.getSpecificUserTotal.all(req.params.guildId, req.params.userName, req.params.userName);
      const details = await db.getSpecificUserPoints.all(req.params.guildId, req.params.userName, req.params.userName);
      res.json({ success: true, data: { total: total[0] || null, entries: details } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Clear all points for a guild
  app.delete('/api/points/:guildId', auth, async (req, res) => {
    try {
      await db.clearGuildPoints.run(req.params.guildId);
      res.json({ success: true, message: 'Points cleared' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get guild list
  app.get('/api/guilds', auth, (req, res) => {
    const guilds = discordClient.guilds.cache.map(g => ({
      id: g.id,
      name: g.name,
      memberCount: g.memberCount,
      icon: g.iconURL()
    }));
    res.json({ success: true, data: guilds });
  });

  // Get channels for a guild
  app.get('/api/guilds/:guildId/channels', auth, (req, res) => {
    const guild = discordClient.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const channels = guild.channels.cache
      .filter(c => c.type === 0) // text channels only
      .map(c => ({ id: c.id, name: c.name }));
    res.json({ success: true, data: channels });
  });

  // Send message to a channel
  app.post('/api/send-message', auth, async (req, res) => {
    try {
      const { channelId, message } = req.body;
      if (!channelId || !message) return res.status(400).json({ error: 'channelId and message required' });
      const channel = await discordClient.channels.fetch(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });
      await channel.send(message);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============ Start server ============
  app.listen(PORT, () => {
    console.log(`🌐 API server running on port ${PORT}`);
  });

  return app;
}

module.exports = { startAPI };
