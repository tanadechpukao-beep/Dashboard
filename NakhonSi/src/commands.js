// commands.js - Slash command definitions and handlers (นครศรีธรรมราช)
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('./database');
const { extractPoints } = require('./ai-extractor');

// แอดมินที่มีสิทธิ์ใช้คำสั่งทั้งหมด (Discord username)
const ADMIN_USERNAMES = ['ez_lihatejj', 'yudaz_06', 'moominnnnnnn'];

function isAdmin(interaction) {
  return ADMIN_USERNAMES.includes(interaction.user.username.toLowerCase());
}

// ============ Command Definitions ============
const commands = [
  new SlashCommandBuilder()
    .setName('points')
    .setDescription('ดูแต้มของผู้ใช้')
    .addStringOption(opt =>
      opt.setName('user').setDescription('ชื่อผู้ใช้ (ชื่อ Roblox) ที่ต้องการดู (ว่างไว้ = ดูทั้งหมด)').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('อันดับแต้มสูงสุด')
    .addIntegerOption(opt =>
      opt.setName('top').setDescription('จำนวนอันดับที่แสดง (default: 10)').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('scan')
    .setDescription('สแกนข้อความย้อนหลังเพื่อนับแต้ม')
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('ช่องที่ต้องการสแกน (ว่างไว้ = ช่องปัจจุบัน)').setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('limit').setDescription('จำนวนข้อความที่สแกน (default: 500, max: 5000)').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('clearpoints')
    .setDescription('ล้างแต้มทั้งหมดของเซิร์ฟเวอร์')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('ตั้งค่าช่องที่บอทจะคอยนับแต้มอัตโนมัติ')
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('ช่องที่ต้องการให้นับแต้ม').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('pointhelp')
    .setDescription('วิธีใช้บอทนับแต้ม'),

  new SlashCommandBuilder()
    .setName('setchat')
    .setDescription('ตั้งค่าช่องคุยเล่นกับบอท (บอทตอบทุกข้อความ)')
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('ช่องคุยเล่น').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('unsetchat')
    .setDescription('ปิดช่องคุยเล่นกับบอท')
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('ช่องที่ต้องการปิด').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('addpoints')
    .setDescription('เพิ่มแต้มให้ผู้ใช้ด้วยตนเอง')
    .addStringOption(opt =>
      opt.setName('user').setDescription('ชื่อ Roblox ของผู้ใช้').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('จำนวนแต้มที่ต้องการเพิ่ม').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('activity').setDescription('กิจกรรม/เหตุผล').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('removepoints')
    .setDescription('ลดแต้มของผู้ใช้')
    .addStringOption(opt =>
      opt.setName('user').setDescription('ชื่อ Roblox ของผู้ใช้').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('จำนวนแต้มที่ต้องการลด').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('เหตุผล').setRequired(false)
    ),
];

// ============ Command Handlers ============

async function handlePoints(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้ (เฉพาะแอดมินเท่านั้น)', ephemeral: true });
  }
  const userName = interaction.options.getString('user');
  const guildId = interaction.guildId;

  if (userName) {
    const results = await db.getSpecificUserTotal.all(guildId, userName);
    if (results.length === 0) {
      return interaction.reply({ content: `❌ ไม่พบข้อมูลแต้มของ **${userName}**`, ephemeral: true });
    }

    const user = results[0];
    const details = await db.getSpecificUserPoints.all(guildId, userName);

    const embed = new EmbedBuilder()
      .setTitle(`📊 แต้มของ ${user.roblox_name}`)
      .setColor(0x00AE86)
      .addFields(
        { name: '🎮 ชื่อ Roblox', value: user.roblox_name || '-', inline: true },
        { name: '💬 ชื่อ Discord', value: user.discord_name || '-', inline: true },
        { name: '⭐ แต้มรวม', value: `**${user.total_points.toLocaleString()}** แต้ม`, inline: true },
        { name: '📝 จำนวนผลงาน', value: `${user.entry_count}`, inline: true }
      )
      .setTimestamp();

    // Show last 10 entries
    if (details.length > 0) {
      const recentEntries = details.slice(0, 10).map((d, i) =>
        `${i + 1}. **${d.points}** แต้ม — ${d.activity || 'ไม่ระบุ'} — ${d.created_at ? new Date(d.created_at).toLocaleDateString('th-TH') : 'N/A'}`
      ).join('\n');
      embed.addFields({ name: 'ผลงานล่าสุด (10 รายการ)', value: recentEntries });
    }

    return interaction.reply({ embeds: [embed] });
  }

  // Show all users
  const results = await db.getUserPoints.all(guildId);
  if (results.length === 0) {
    return interaction.reply({ content: '📭 ยังไม่มีข้อมูลแต้ม ลองใช้ `/scan` เพื่อสแกนข้อความย้อนหลัง', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('📊 แต้มทั้งหมด — เมืองนครศรีธรรมราช')
    .setColor(0x00AE86)
    .setDescription(
      results.map((r, i) =>
        `**${i + 1}.** ${r.roblox_name} — **${r.total_points.toLocaleString()}** แต้ม (${r.entry_count} ผลงาน)`
      ).join('\n')
    )
    .setTimestamp()
    .setFooter({ text: `ทั้งหมด ${results.length} คน` });

  return interaction.reply({ embeds: [embed] });
}

async function handleLeaderboard(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้ (เฉพาะแอดมินเท่านั้น)', ephemeral: true });
  }
  const top = Math.min(interaction.options.getInteger('top') || 10, 50);
  const guildId = interaction.guildId;

  const results = await db.getLeaderboard.all(guildId, top);
  if (results.length === 0) {
    return interaction.reply({ content: '📭 ยังไม่มีข้อมูลแต้ม', ephemeral: true });
  }

  const medals = ['🥇', '🥈', '🥉'];
  const embed = new EmbedBuilder()
    .setTitle(`🏆 อันดับแต้มสูงสุด Top ${top} — เมืองนครศรีธรรมราช`)
    .setColor(0xFFD700)
    .setDescription(
      results.map((r, i) => {
        const medal = medals[i] || `**${i + 1}.**`;
        return `${medal} ${r.roblox_name} — **${r.total_points.toLocaleString()}** แต้ม`;
      }).join('\n')
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

async function handleScan(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้ (เฉพาะแอดมินเท่านั้น)', ephemeral: true });
  }
  await interaction.deferReply();

  const channel = interaction.options.getChannel('channel') || interaction.channel;
  const limit = Math.min(interaction.options.getInteger('limit') || 500, 5000);
  const guildId = interaction.guildId;

  let scanned = 0;
  let extracted = 0;
  let skipped = 0;
  let lastId = null;
  let remaining = limit;

  const statusEmbed = new EmbedBuilder()
    .setTitle('🔍 กำลังสแกนข้อความ...')
    .setColor(0xFFA500)
    .setDescription(`กำลังสแกนช่อง <#${channel.id}> จำนวน ${limit} ข้อความ`)
    .setTimestamp();

  await interaction.editReply({ embeds: [statusEmbed] });

  try {
    while (remaining > 0) {
      const fetchSize = Math.min(remaining, 100);
      const options = { limit: fetchSize };
      if (lastId) options.before = lastId;

      const messages = await channel.messages.fetch(options);
      if (messages.size === 0) break;

      for (const [, msg] of messages) {
        scanned++;
        lastId = msg.id;

        if (msg.author.bot || msg.content.length < 15) {
          skipped++;
          continue;
        }

        if (await db.messageExists.get(msg.id)) {
          skipped++;
          continue;
        }

        const result = await extractPoints(msg.content);
        if (result && (result.points > 0 || result.roblox_name)) {
          try {
            await db.insertPoint.run({
              guild_id: guildId,
              roblox_name: result.roblox_name || msg.author.username,
              discord_name: result.discord_name || msg.author.tag,
              activity: result.activity || null,
              points: result.points || 0,
              work_number: result.work_number || 0,
              message_id: msg.id,
              channel_id: channel.id,
              raw_message: msg.content.substring(0, 2000)
            });
            extracted++;
          } catch (e) {
            // duplicate message_id, skip
          }
        }
      }

      remaining -= fetchSize;

      if (scanned % 200 === 0) {
        statusEmbed.setDescription(
          `กำลังสแกน... ${scanned}/${limit} ข้อความ\n✅ นับได้ ${extracted} รายการ | ⏭️ ข้าม ${skipped}`
        );
        await interaction.editReply({ embeds: [statusEmbed] }).catch(() => {});
      }
    }

    if (lastId) {
      await db.saveScanHistory.run(guildId, channel.id, lastId);
    }

    const doneEmbed = new EmbedBuilder()
      .setTitle('✅ สแกนเสร็จสิ้น!')
      .setColor(0x00FF00)
      .addFields(
        { name: '📨 ข้อความที่สแกน', value: `${scanned}`, inline: true },
        { name: '✅ นับแต้มได้', value: `${extracted} รายการ`, inline: true },
        { name: '⏭️ ข้าม', value: `${skipped}`, inline: true },
        { name: '📌 ช่อง', value: `<#${channel.id}>`, inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [doneEmbed] });
  } catch (err) {
    console.error('Scan error:', err);
    return interaction.editReply({ content: `❌ เกิดข้อผิดพลาด: ${err.message}` });
  }
}

async function handleClearPoints(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้ (เฉพาะแอดมินเท่านั้น)', ephemeral: true });
  }
  const guildId = interaction.guildId;
  await db.clearGuildPoints.run(guildId);
  return interaction.reply({ content: '🗑️ ล้างแต้มทั้งหมดของเซิร์ฟเวอร์เรียบร้อยแล้ว!' });
}

async function handleSetChannel(interaction, watchedChannels) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้ (เฉพาะแอดมินเท่านั้น)', ephemeral: true });
  }
  const channel = interaction.options.getChannel('channel');
  const guildId = interaction.guildId;

  if (!watchedChannels.has(guildId)) {
    watchedChannels.set(guildId, new Set());
  }
  watchedChannels.get(guildId).add(channel.id);

  return interaction.reply({
    content: `✅ ตั้งค่าช่อง <#${channel.id}> เป็นช่องนับแต้มอัตโนมัติแล้ว!\nบอทจะนับแต้มจากข้อความใหม่ในช่องนี้โดยอัตโนมัติ`
  });
}

async function handleAddPoints(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้ (เฉพาะแอดมินเท่านั้น)', ephemeral: true });
  }
  const userName = interaction.options.getString('user');
  const amount = interaction.options.getInteger('amount');
  const activity = interaction.options.getString('activity') || 'เพิ่มด้วยคำสั่ง';
  const guildId = interaction.guildId;

  await db.insertPoint.run({
    guild_id: guildId,
    roblox_name: userName,
    discord_name: null,
    activity: activity,
    points: amount,
    work_number: 0,
    message_id: null,
    channel_id: interaction.channelId,
    raw_message: `[Manual] ${interaction.user.tag} added ${amount} points to ${userName} — ${activity}`
  });

  const embed = new EmbedBuilder()
    .setColor(0x00AE86)
    .setDescription(
      `✅ **เพิ่มแต้มสำเร็จ**\n` +
      `🎮 **${userName}**\n` +
      `⭐ +**${amount}** แต้ม\n` +
      `📝 กิจกรรม: ${activity}\n` +
      `👤 โดย: ${interaction.user.tag}`
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

async function handleRemovePoints(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้ (เฉพาะแอดมินเท่านั้น)', ephemeral: true });
  }
  const userName = interaction.options.getString('user');
  const amount = interaction.options.getInteger('amount');
  const reason = interaction.options.getString('reason') || 'ลดด้วยคำสั่ง';
  const guildId = interaction.guildId;

  await db.insertPoint.run({
    guild_id: guildId,
    roblox_name: userName,
    discord_name: null,
    activity: `[ลดแต้ม] ${reason}`,
    points: -amount,
    work_number: 0,
    message_id: null,
    channel_id: interaction.channelId,
    raw_message: `[Manual] ${interaction.user.tag} removed ${amount} points from ${userName} — ${reason}`
  });

  const embed = new EmbedBuilder()
    .setColor(0xFF4444)
    .setDescription(
      `❌ **ลดแต้มสำเร็จ**\n` +
      `🎮 **${userName}**\n` +
      `⬇️ -**${amount}** แต้ม\n` +
      `📝 เหตุผล: ${reason}\n` +
      `👤 โดย: ${interaction.user.tag}`
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

async function handleHelp(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้ (เฉพาะแอดมินเท่านั้น)', ephemeral: true });
  }
  const embed = new EmbedBuilder()
    .setTitle('📖 วิธีใช้บอทนับแต้ม — เมืองนครศรีธรรมราช')
    .setColor(0x5865F2)
    .setDescription('บอทนี้ใช้ AI ในการอ่านข้อความแบบฟอร์มผลงาน/เข้าเวร แล้วนับแต้มโดยอัตโนมัติ')
    .addFields(
      {
        name: '📌 คำสั่งหลัก',
        value: [
          '`/scan` — สแกนข้อความย้อนหลังเพื่อนับแต้ม',
          '`/points` — ดูแต้มทั้งหมด',
          '`/points user:ชื่อ` — ดูแต้มของคนใดคนหนึ่ง',
          '`/leaderboard` — อันดับแต้มสูงสุด',
          '`/setchannel` — ตั้งช่องนับแต้มอัตโนมัติ',
          '`/addpoints` — เพิ่มแต้ม (🔒 Admin)',
          '`/removepoints` — ลดแต้ม (🔒 Admin)',
          '`/clearpoints` — ล้างแต้มทั้งหมด (🔒 Admin)',
        ].join('\n')
      },
      {
        name: '🤖 AI นับแต้ม',
        value: 'บอทจะอ่านข้อความที่มีรูปแบบแบบฟอร์ม เช่น\n`ชื่อในเกม : xxx`\n`ผลงานนี้กี่แต้ม : 5`\n`ระยะเวลาการเข้าเวร : xxx`\nและดึงข้อมูลออกมาอัตโนมัติ'
      },
      {
        name: '📋 รูปแบบแบบฟอร์มที่รองรับ',
        value: [
          '**แบบผลงาน:** ชื่อในเกม, ชื่อในดิส, กิจกรรม, กี่แต้ม, แต้มรวม',
          '**แบบเข้าเวร:** ชื่อในเกม, ชื่อในดิส, ระยะเวลาเข้าเวร, สถานการณ์',
        ].join('\n')
      }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

async function handleSetChat(interaction, chatChannels) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้ (เฉพาะแอดมินเท่านั้น)', ephemeral: true });
  }
  const channel = interaction.options.getChannel('channel');
  const guildId = interaction.guildId;

  if (!chatChannels.has(guildId)) {
    chatChannels.set(guildId, new Set());
  }
  chatChannels.get(guildId).add(channel.id);

  return interaction.reply({
    content: `✅ ตั้งช่อง <#${channel.id}> เป็นช่องคุยเล่นกับน้องมายแล้ว! 💬\nบอทจะตอบทุกข้อความในช่องนี้`
  });
}

async function handleUnsetChat(interaction, chatChannels) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้ (เฉพาะแอดมินเท่านั้น)', ephemeral: true });
  }
  const channel = interaction.options.getChannel('channel');
  const guildId = interaction.guildId;

  if (chatChannels.has(guildId)) {
    chatChannels.get(guildId).delete(channel.id);
  }

  return interaction.reply({
    content: `❌ ปิดช่องคุยเล่น <#${channel.id}> แล้ว`
  });
}

module.exports = {
  commands,
  handlePoints,
  handleLeaderboard,
  handleScan,
  handleClearPoints,
  handleSetChannel,
  handleAddPoints,
  handleRemovePoints,
  handleSetChat,
  handleUnsetChat,
  handleHelp
};
