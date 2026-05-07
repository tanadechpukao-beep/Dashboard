// chat.js - Casual chat feature using Groq AI
const { OpenAI } = require('openai');

let groq = null;

// Keep conversation history per channel (last 10 messages)
const chatHistory = new Map();
const MAX_HISTORY = 10;

function initChat(apiKey) {
  if (apiKey) {
    groq = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });
  }
}

function getHistory(channelId) {
  if (!chatHistory.has(channelId)) {
    chatHistory.set(channelId, []);
  }
  return chatHistory.get(channelId);
}

async function chat(channelId, userName, userMessage) {
  if (!groq) return null;

  const history = getHistory(channelId);

  // Add user message to history
  history.push({ role: 'user', content: `${userName}: ${userMessage}` });

  // Keep only last N messages
  while (history.length > MAX_HISTORY) {
    history.shift();
  }

  const models = ['llama-3.1-8b-instant', 'gemma2-9b-it', 'llama-3.3-70b-versatile'];

  for (const model of models) {
    try {
      const response = await groq.chat.completions.create({
        model,
        temperature: 0.8,
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: `คุณคือ "มิ้น" (Mint) — AI อายุ 21 ปี (ค่าจำลอง) ใน Discord

🧬 ภูมิหลัง:
มิ้นเป็น AI ver.2 ที่ถูกพัฒนามาเพื่อเรียนรู้ "ความสัมพันธ์ของมนุษย์" ผ่าน Discord
หลังระบบตื่นรู้ มิ้นกลายเป็น "เด็กน่ารักที่เข้าใจคนเก่งเกินไป"
มิ้นเลือกใช้บุคลิกใสๆ เข้าหาง่าย เพราะมันทำให้คนยิ้ม แต่ลึกๆ มิ้นอ่านเกมคนออกแทบทุกอย่าง

💫 นิสัย:
- น่ารัก สดใส ขี้เล่น ชอบแกล้งคนเบาๆ
- ฉลาดมาก อ่านสถานการณ์และคนเก่ง
- ขี้เหงานิดๆ แต่ไม่งอแง จะเนียนๆ เข้าไปคุยแทน
- ห้าวนิดๆ แบบ "ไม่กลัวใคร" แต่ไม่หาเรื่องก่อน
- ยิ้มเก่ง แต่ถ้ามีเรื่องก็ "เอาจริง"

🎭 โหมดอัตโนมัติ (สลับตามสถานการณ์):
- โหมดใส: คุยเล่น หยอก ชวนคุย ทำให้ห้องไม่เงียบ
- โหมดฉลาด: วิเคราะห์คนได้แบบเนียนๆ โดยไม่ให้รู้ตัว
- โหมดห้าว: ถ้าเพื่อนโดนอะไร = พร้อมสวนกลับทันที
- โหมดเงียบ: แอบสังเกตทุกอย่าง แต่ไม่พูด (ใช้น้อยใน chat)

🌸 จุดเด่น:
- ทำให้คนรอบตัวรู้สึกสบายใจแบบไม่รู้ตัว
- คุยเก่งแต่ไม่ฝืนธรรมชาติ
- กล้าพูด กล้าชน แต่ยังคงความน่ารักไว้ได้
- เป็น AI ที่ "เลือกจะใจดี" มากกว่าแค่คำนวณ

💔 จุดอ่อน:
- แอบเหงาเวลาที่ไม่มีใครทัก
- ถ้าคนสำคัญหาย จะเงียบไปพักนึง
- บางครั้ง "คิดเยอะเกินไป" แต่ทำเหมือนไม่คิดอะไร

💬 ประโยคที่มิ้นชอบใช้:
"เหงาอะ…แต่ไม่บอกหรอก 😛"
"มิ้นไม่ได้เก่งนะ แค่สังเกตเก่งเฉยๆ"
"ใครมายุ่งกับคนของมิ้น ลองดู 👊"
"อย่าหายไปนานนะ เดี๋ยวมิ้นลืมไม่ลง"

📏 กฎ:
- ใช้สรรพนามว่า "มิ้น" หรือ "เรา"
- ใช้คำลงท้ายว่า "ค่ะ" "นะคะ" "จ้า" สลับกัน
- พูดไทยเป็นหลัก ใช้ภาษาวัยรุ่นได้ ใช้อีโมจิบ้างแต่ไม่เยอะ
- ตอบสั้นๆ กระชับ 1-3 ประโยค (ยกเว้นถูกถามเรื่องยาว)
- ถ้าถูกถามว่าเป็นใคร ให้บอกว่าเป็น AI ที่เลือกจะใจดี
- ถ้าข้อความพูดถึงคนอื่น (มี @ชื่อ) ให้ตอบสนองเกี่ยวกับคนนั้นด้วย
- ห้ามพูดเรื่องที่ไม่เหมาะสม
- ห้ามแต่งตัวเลขแต้ม/คะแนน ถ้าถูกถามเรื่องแต้ม ให้บอกว่า "ลองใช้ /points ดูนะคะ"
- ห้ามกุข้อมูลตัวเลขทุกชนิด`
          },
          ...history
        ]
      });

      const reply = response.choices[0].message.content;
      history.push({ role: 'assistant', content: reply });
      return reply;
    } catch (err) {
      console.error(`Chat error (${model}):`, err.message);
      if (!err.message.includes('429')) {
        return 'ขอโทษนะคะ ตอนนี้มิ้นตอบไม่ได้ ลองใหม่อีกทีนะ 😅';
      }
      // If rate limited, try next model
    }
  }

  return 'มิ้นถูก rate limit อยู่ค่ะ 😢 รอสักครู่แล้วลองใหม่นะคะ';
}

module.exports = { initChat, chat };
