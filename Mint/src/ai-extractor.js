// ai-extractor.js - Extract point data from messages using AI (Groq) or regex fallback
const { OpenAI } = require('openai');

let groq = null;

function initAI(apiKey) {
  if (apiKey) {
    groq = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });
    console.log('✅ Groq AI extractor initialized');
  } else {
    console.log('⚠️ No GROQ_API_KEY set — using regex fallback only');
  }
}

// --- Regex fallback extractor ---
function regexExtract(text) {
  const result = {
    user_name: null,
    discord_name: null,
    rank_name: null,
    amount: 0,
    confidence: 0
  };

  // Extract [ Name ] : value
  const nameMatch = text.match(/\[\s*Name\s*\]\s*:\s*(.+)/i);
  if (nameMatch) result.user_name = nameMatch[1].trim();

  // Extract [ Name discord ] : value
  const discordMatch = text.match(/\[\s*Name\s*discord\s*\]\s*:\s*(.+)/i);
  if (discordMatch) result.discord_name = discordMatch[1].trim().replace(/@/g, '');

  // Extract ยศกรม / rank
  const rankMatch = text.match(/\[\s*ยศกรม\s*\]\s*:\s*(.+)/i);
  if (rankMatch) result.rank_name = rankMatch[1].trim();

  const MAX_AMOUNT = 10_000_000; // 10 ล้าน — ป้องกันดึงเลข Discord ID

  // Extract จ่ายกี่บาท / amount — look for number patterns
  const amountMatch = text.match(/\[\s*จ่ายกี่บาท\s*\?\s*\]\s*:?\s*([\d,\.]+)/i);
  if (amountMatch) {
    const parsed = parseInt(amountMatch[1].replace(/[,\.]/g, ''), 10);
    if (parsed > 0 && parsed <= MAX_AMOUNT) result.amount = parsed;
  }

  // Fallback: look for number + บาท/baht keyword
  if (!result.amount) {
    const amountKeyword = text.match(/(\d[\d,]*)\s*(?:บาท|baht|฿)/i);
    if (amountKeyword) {
      const parsed = parseInt(amountKeyword[1].replace(/,/g, ''), 10);
      if (parsed >= 100 && parsed <= MAX_AMOUNT) result.amount = parsed;
    }
  }

  // Fallback: look for :number pattern in form-like lines (skip lines with IDs/links)
  if (!result.amount) {
    const amounts = [];
    const lines = text.split('\n');
    for (const line of lines) {
      // Skip lines that look like Discord IDs, links, or mentions
      if (line.match(/discord\.gg|http|<@|<#|\d{15,}/)) continue;
      const m = line.match(/:\s*([\d,]+)\s*$/); 
      if (m) {
        const num = parseInt(m[1].replace(/,/g, ''), 10);
        if (num >= 100 && num <= MAX_AMOUNT) amounts.push(num);
      }
    }
    if (amounts.length > 0) {
      result.amount = Math.max(...amounts);
    }
  }

  // Calculate confidence
  if (result.user_name) result.confidence += 0.3;
  if (result.amount > 0) result.confidence += 0.4;
  if (result.rank_name) result.confidence += 0.15;
  if (result.discord_name) result.confidence += 0.15;

  return result;
}

// --- AI extractor using Groq ---
async function aiExtract(text) {
  if (!groq) return null;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `คุณเป็น AI ที่ช่วยดึงข้อมูลจากข้อความ Discord ที่เป็นแบบฟอร์มส่งงานหรือรายงานแต้ม

ให้ดึงข้อมูลต่อไปนี้จากข้อความ:
- user_name: ชื่อผู้ใช้ในเกม (จาก [ Name ] หรือชื่อที่ปรากฏ)
- discord_name: ชื่อ Discord (จาก [ Name discord ] หรือ @mention)
- rank_name: ยศ/ตำแหน่ง (จาก [ ยศกรม ] หรือข้อความที่บอกยศ)
- amount: จำนวนเงิน/แต้ม (ตัวเลข เช่น จาก [ จ่ายกี่บาท ] หรือตัวเลขที่เกี่ยวข้อง)
- confidence: ความมั่นใจ 0.0-1.0

ตอบเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น
ถ้าไม่พบข้อมูลไหน ให้ใส่ null (สำหรับ amount ใส่ 0)`
        },
        {
          role: 'user',
          content: text
        }
      ],
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return {
      user_name: parsed.user_name || null,
      discord_name: parsed.discord_name || null,
      rank_name: parsed.rank_name || null,
      amount: Math.min(parseInt(parsed.amount, 10) || 0, 10_000_000),
      confidence: parseFloat(parsed.confidence) || 0
    };
  } catch (err) {
    console.error('AI extraction error:', err.message);
    return null;
  }
}

// --- Main extraction function ---
// Returns amount in BAHT (raw). Conversion to points is done in display layer.

async function extractPoints(text) {
  // Pre-check: message must look like a form submission
  const formKeywords = /\[\s*Name\s*\]|\u0e08\u0e48\u0e32\u0e22\u0e01\u0e35\u0e48\u0e1a\u0e32\u0e17|\u0e2a\u0e48\u0e07\u0e07\u0e32\u0e19|\u0e22\u0e28\u0e01\u0e23\u0e21|\u0e1d\u0e48\u0e32\u0e22\u0e1a\u0e31\u0e0d\u0e0a\u0e35|\u0e1f\u0e32\u0e23\u0e4c\u0e21\u0e40\u0e07\u0e34\u0e19/i;
  if (!formKeywords.test(text)) return null;

  // Try AI first
  const aiResult = await aiExtract(text);

  // Always run regex as backup
  const regexResult = regexExtract(text);

  // If AI result is good, prefer it
  if (aiResult && aiResult.confidence >= 0.5 && aiResult.amount > 0) {
    return { ...aiResult, method: 'ai' };
  }

  // If regex result is good, use it
  if (regexResult.confidence >= 0.4 && regexResult.amount > 0) {
    return { ...regexResult, method: 'regex' };
  }

  // If AI had any result, use it
  if (aiResult && aiResult.amount > 0) {
    return { ...aiResult, method: 'ai' };
  }

  // Return regex result even if low confidence
  if (regexResult.amount > 0) {
    return { ...regexResult, method: 'regex' };
  }

  return null; // Could not extract
}

module.exports = { initAI, extractPoints, regexExtract };
