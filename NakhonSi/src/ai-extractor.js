// ai-extractor.js - Extract point data from messages using AI (Groq) or regex fallback
// สำหรับแบบฟอร์มผลงาน/เข้าเวร นครศรีธรรมราช
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
    roblox_name: null,
    discord_name: null,
    activity: null,
    points: 0,
    total_points: 0,
    work_number: 0,
    confidence: 0
  };

  // Extract roblox name: "ชื่อในเกม : TomAe145" or "name roblox...ชื่อในเกม : xxx"
  const robloxMatch = text.match(/(?:ชื่อในเกม|name\s*roblox)\s*[:\-]\s*(.+)/i);
  if (robloxMatch) {
    result.roblox_name = robloxMatch[1].trim().split('\n')[0].trim();
  }

  // Extract discord name: "ชื่อในดิส : @[...]" or "name discord...ชื่อในดิส : xxx"
  const discordMatch = text.match(/(?:ชื่อในดิส|name\s*discord)\s*[:\-]\s*(.+)/i);
  if (discordMatch) {
    result.discord_name = discordMatch[1].trim().split('\n')[0].trim();
  }

  // Extract activity: "กิจกรรมอะไร" or "กิจกรรม"
  const activityMatch = text.match(/กิจกรรม(?:อะไร)?[^:\n]*[:\-]\s*(.+)/i);
  if (activityMatch) {
    result.activity = activityMatch[1].trim().split('\n')[0].trim();
  }

  // Fallback activity: "ระยะเวลาการเข้าเวร" means guard duty
  if (!result.activity) {
    const dutyMatch = text.match(/ระยะเวลาการเข้าเวร/i);
    if (dutyMatch) {
      result.activity = 'เข้าเวร';
    }
  }

  // Fallback activity: "คุ้มกัน" means guard duty
  if (!result.activity) {
    const guardMatch = text.match(/คุ้มกัน/i);
    if (guardMatch) {
      result.activity = 'คุ้มกัน';
    }
  }

  // Extract points: "ผลงานนี้กี่แต้ม" or "กี่แต้ม"
  const pointsMatch = text.match(/(?:ผลงานนี้)?กี่แต้ม\s*[:\-]\s*(\d+)/i);
  if (pointsMatch) {
    result.points = parseInt(pointsMatch[1], 10);
  }

  // Fallback points: look for "แต้ม" near a number
  if (!result.points) {
    const ptMatch = text.match(/(\d+)\s*แต้ม/i);
    if (ptMatch) {
      const num = parseInt(ptMatch[1], 10);
      if (num > 0 && num <= 10000) result.points = num;
    }
  }

  // Extract total points: "แต้มรวมทั้งหมดตอนนี้"
  const totalMatch = text.match(/แต้มรวม(?:ทั้งหมด)?(?:ตอนนี้)?\s*[:\-]\s*(\d+)/i);
  if (totalMatch) {
    result.total_points = parseInt(totalMatch[1], 10);
  }

  // Extract work number: "ผลงานที่เท่าไหร่" or "ผลงานที่"
  const workMatch = text.match(/ผลงานที่(?:เท่าไหร่)?\s*[:\-]\s*(\d+)/i);
  if (workMatch) {
    result.work_number = parseInt(workMatch[1], 10);
  }

  // Calculate confidence
  if (result.roblox_name) result.confidence += 0.3;
  if (result.points > 0) result.confidence += 0.35;
  if (result.discord_name) result.confidence += 0.15;
  if (result.activity) result.confidence += 0.1;
  if (result.work_number > 0) result.confidence += 0.1;

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
          content: `คุณเป็น AI ที่ช่วยดึงข้อมูลจากข้อความ Discord ที่เป็นแบบฟอร์มรายงานผลงาน/เข้าเวร ของเมืองนครศรีธรรมราช (Roblox RP)

แบบฟอร์มมีหลายรูปแบบ เช่น:
1. แบบผลงาน: มี ชื่อในเกม, ชื่อในดิส, กิจกรรม, กี่แต้ม, แต้มรวม, ผลงานที่เท่าไหร่
2. แบบเข้าเวร: มี ชื่อในเกม, ชื่อในดิส, ระยะเวลา, สถานการณ์, คนที่คุ้มกัน

ให้ดึงข้อมูลต่อไปนี้:
- roblox_name: ชื่อในเกม Roblox
- discord_name: ชื่อ Discord
- activity: กิจกรรม/ประเภทงาน (เช่น "รวมงานแต่ง", "เข้าเวร", "คุ้มกัน")
- points: จำนวนแต้มของผลงานนี้ (ถ้าไม่ระบุให้ใส่ 0)
- total_points: แต้มรวมทั้งหมด (ถ้าไม่ระบุให้ใส่ 0)
- work_number: ผลงานที่เท่าไหร่ (ถ้าไม่ระบุให้ใส่ 0)
- confidence: ความมั่นใจ 0.0-1.0

ตอบเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น
ถ้าไม่พบข้อมูลไหน ให้ใส่ null (สำหรับตัวเลขใส่ 0)`
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
      roblox_name: parsed.roblox_name || null,
      discord_name: parsed.discord_name || null,
      activity: parsed.activity || null,
      points: parseInt(parsed.points, 10) || 0,
      total_points: parseInt(parsed.total_points, 10) || 0,
      work_number: parseInt(parsed.work_number, 10) || 0,
      confidence: parseFloat(parsed.confidence) || 0
    };
  } catch (err) {
    console.error('AI extraction error:', err.message);
    return null;
  }
}

// --- Main extraction function ---
async function extractPoints(text) {
  // Pre-check: message must look like a form submission
  const formKeywords = /ชื่อในเกม|name\s*roblox|ชื่อในดิส|name\s*discord|กี่แต้ม|ผลงาน|เข้าเวร|คุ้มกัน|กิจกรรม|ระยะเวลา|ผู้ตรวจสอบ|สถานการณ์/i;
  if (!formKeywords.test(text)) return null;

  // Try AI first
  const aiResult = await aiExtract(text);

  // Always run regex as backup
  const regexResult = regexExtract(text);

  // If AI result is good, prefer it
  if (aiResult && aiResult.confidence >= 0.5 && (aiResult.points > 0 || aiResult.roblox_name)) {
    return { ...aiResult, method: 'ai' };
  }

  // If regex result is good, use it
  if (regexResult.confidence >= 0.4 && (regexResult.points > 0 || regexResult.roblox_name)) {
    return { ...regexResult, method: 'regex' };
  }

  // If AI had any result, use it
  if (aiResult && (aiResult.points > 0 || aiResult.roblox_name)) {
    return { ...aiResult, method: 'ai' };
  }

  // Return regex result even if low confidence
  if (regexResult.points > 0 || regexResult.roblox_name) {
    return { ...regexResult, method: 'regex' };
  }

  return null;
}

module.exports = { initAI, extractPoints, regexExtract };
