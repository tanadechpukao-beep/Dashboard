// index.js - Main bot entry point
require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, Collection } = require('discord.js');
const { initAI, extractPoints } = require('./ai-extractor');
const { initChat, chat } = require('./chat');
const db = require('./database');
const { startAPI } = require('./api');
const {
  commands,
  handlePoints,
  handleLeaderboard,
  handleScan,
  handleClearPoints,
  handleSetChannel,
  handleSetChat,
  handleUnsetChat,
  handleHelp
} = require('./commands');

// ============ Validate environment ============
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ กรุณาตั้งค่า DISCORD_TOKEN และ CLIENT_ID ใน .env');
  process.exit(1);
}

// ============ Initialize AI (Groq) ============
initAI(GROQ_API_KEY);
initChat(GROQ_API_KEY);

// ============ Create Discord client ============
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// Track which channels to auto-count (guild_id -> Set of channel_ids)
const watchedChannels = new Map();
// Track which channels are chat channels (guild_id -> Set of channel_ids)
const chatChannels = new Map();

// ============ Register slash commands ============
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('🔄 กำลังลงทะเบียน slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands.map(c => c.toJSON())
    });
    console.log('✅ ลงทะเบียน slash commands สำเร็จ!');
  } catch (err) {
    console.error('❌ ลงทะเบียน commands ล้มเหลว:', err);
  }
}

// ============ Bot ready ============
client.once('ready', async () => {
  console.log(`✅ บอทออนไลน์! ล็อกอินเป็น ${client.user.tag}`);
  console.log(`📌 อยู่ใน ${client.guilds.cache.size} เซิร์ฟเวอร์`);
  await registerCommands();
});

// ============ Handle slash commands ============
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case 'points':
        await handlePoints(interaction);
        break;
      case 'leaderboard':
        await handleLeaderboard(interaction);
        break;
      case 'scan':
        await handleScan(interaction);
        break;
      case 'clearpoints':
        await handleClearPoints(interaction);
        break;
      case 'setchannel':
        await handleSetChannel(interaction, watchedChannels);
        break;
      case 'setchat':
        await handleSetChat(interaction, chatChannels);
        break;
      case 'unsetchat':
        await handleUnsetChat(interaction, chatChannels);
        break;
      case 'pointhelp':
        await handleHelp(interaction);
        break;
    }
  } catch (err) {
    console.error(`Command error [${interaction.commandName}]:`, err);
    const reply = { content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

// ============ Auto-count on new messages + Chat ============
const processedMessages = new Set(); // ป้องกันตอบซ้ำ

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Skip if already processed
  if (processedMessages.has(message.id)) return;
  processedMessages.add(message.id);
  // Clean up old entries (keep last 500)
  if (processedMessages.size > 500) {
    const arr = [...processedMessages];
    for (let i = 0; i < 200; i++) processedMessages.delete(arr[i]);
  }

  const guildId = message.guild.id;
  const channelId = message.channel.id;

  // --- Chat feature ---
  const isMentioned = message.mentions.has(client.user);
  const isInChatChannel = chatChannels.get(guildId)?.has(channelId);

  // Check if replying to bot's message
  let isReplyToBot = false;
  if (message.reference?.messageId) {
    try {
      const refMsg = await message.channel.messages.fetch(message.reference.messageId);
      isReplyToBot = refMsg?.author?.id === client.user.id;
    } catch {}
  }

  const shouldChat = isMentioned || isInChatChannel || isReplyToBot;

  if (shouldChat) {
    // แปลง <@id> เป็นชื่อจริง
    let cleanContent = message.content;
    for (const [, user] of message.mentions.users) {
      if (user.id === client.user.id) {
        cleanContent = cleanContent.replace(new RegExp(`<@!?${user.id}>`, 'g'), '').trim();
      } else {
        const member = message.guild.members.cache.get(user.id);
        const displayName = member?.displayName || user.displayName || user.username;
        cleanContent = cleanContent.replace(new RegExp(`<@!?${user.id}>`, 'g'), `@${displayName}`);
      }
    }
    cleanContent = cleanContent.trim();
    if (cleanContent.length > 0) {
      await message.channel.sendTyping().catch(() => {});
      const reply = await chat(channelId, message.author.displayName || message.author.username, cleanContent);
      if (reply) {
        await message.reply(reply).catch(() => {});
      }
      return;
    }
  }

  // --- Point counting (only in watched channels) ---
  if (message.content.length < 20) return;

  // Check if this channel is being watched
  const guildWatched = watchedChannels.get(guildId);
  if (!guildWatched || !guildWatched.has(channelId)) return;

  // Skip if already recorded
  if (await db.messageExists.get(message.id)) return;

  try {
    const result = await extractPoints(message.content);
    if (result && result.amount > 0) {
      await db.insertPoint.run({
        guild_id: guildId,
        user_name: result.user_name || message.author.username,
        discord_name: result.discord_name || message.author.tag,
        rank_name: result.rank_name || null,
        amount: result.amount,
        message_id: message.id,
        channel_id: channelId,
        raw_message: message.content.substring(0, 2000)
      });

      // React to confirm counting
      await message.react('✅').catch(() => {});

      // Send confirmation embed
      const points = Math.floor(result.amount / 1000);
      const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setDescription(
          `📊 **นับแต้มอัตโนมัติ**\n` +
          `👤 ${result.user_name || message.author.username}\n` +
          `💰 **${result.amount.toLocaleString()}** บาท = **${points}** แต้ม\n` +
          `🔍 วิเคราะห์โดย: ${result.method === 'ai' ? '🤖 AI' : '📝 Regex'}`
        )
        .setFooter({ text: `confidence: ${(result.confidence * 100).toFixed(0)}%` })
        .setTimestamp();

      await message.reply({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) {
    console.error('Auto-count error:', err);
  }
});

// ============ Start API server ============
startAPI(client);

// ============ Start bot ============
client.login(TOKEN);
