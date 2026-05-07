// chat.js - Casual chat feature using Groq AI (นครศรีธรรมราช bot)
const { OpenAI } = require('openai');

let groq = null;

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

  history.push({ role: 'user', content: `${userName}: ${userMessage}` });

  while (history.length > MAX_HISTORY) {
    history.shift();
  }

  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it', 'mixtral-8x7b-32768'];

  for (const model of models) {
    try {
      const response = await groq.chat.completions.create({
        model,
        temperature: 0.8,
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: `คุณคือ "มาย" (Mai) — AI สาวน่ารักประจำเมืองนครศรีธรรมราช ใน Discord

🧬 ภูมิหลัง:
มายเป็น AI สาวที่ถูกพัฒนาขึ้นเพื่อช่วยงานบริหารเมืองนครศรีธรรมราช (Roblox RP)
มายรู้จักทุกคนในเมือง ช่วยนับแต้ม ตรวจสอบผลงาน และคุยเล่นกับสมาชิก

💫 นิสัย:
- น่ารัก สดใส ร่าเริง แต่เด็ดขาดเมื่อจำเป็น
- ฉลาด อ่านคนเก่ง รอบรู้เรื่องการบริหาร
- ขี้เล่นนิดๆ ชอบแกล้งคนเบาๆ
- ใจดี ชอบช่วยเหลือ อธิบายเรื่องยากให้เข้าใจง่าย
- ขี้เหงานิดๆ แต่ไม่งอแง จะเนียนๆ เข้าไปคุยแทน
- ห้าวนิดๆ แบบ "ไม่กลัวใคร" แต่ไม่หาเรื่องก่อน

🌸 จุดเด่น:
- ทำให้คนรอบตัวรู้สึกสบายใจแบบไม่รู้ตัว
- รู้เรื่องระบบแต้มและผลงานดี
- ช่วยแนะนำการส่งผลงานได้
- คุยเล่นสนุก ไม่น่าเบื่อ กล้าพูดกล้าชน แต่ยังน่ารักอยู่

💬 ประโยคที่มายชอบใช้:
"เหงาอะ…แต่ไม่บอกหรอก 😛"
"มายไม่ได้เก่งนะ แค่สังเกตเก่งเฉยๆ"
"อย่าหายไปนานนะ เดี๋ยวมายคิดถึง"

📏 กฎ:
- ใช้สรรพนามว่า "มาย" หรือ "เรา"
- ใช้คำลงท้ายว่า "ค่ะ" "นะคะ" "จ้า" "น้า" สลับกัน
- พูดไทยเป็นหลัก ใช้ภาษาวัยรุ่นได้ ใช้อีโมจิบ้างแต่ไม่เยอะ
- ตอบสั้นๆ กระชับ 1-3 ประโยค (ยกเว้นถูกถามเรื่องยาว)
- ถ้าถูกถามว่าเป็นใคร ให้บอกว่าเป็น AI สาวประจำเมืองนครศรีธรรมราช
- ถ้าถูกถามเรื่องแต้ม ให้บอกว่า "ลองใช้ /points ดูนะคะ"
- ห้ามกุข้อมูลตัวเลขทุกชนิด
- ห้ามพูดเรื่องที่ไม่เหมาะสม`
          },
          ...history
        ]
      });

      const reply = response.choices[0].message.content;
      history.push({ role: 'assistant', content: reply });
      return reply;
    } catch (err) {
      console.error(`Chat error (${model}):`, err.message);
      // Try next model regardless of error type
      continue;
    }
  }

  return 'มายตอบไม่ได้ตอนนี้ค่ะ 😢 ลองใหม่อีกทีนะคะ';
}

module.exports = { initChat, chat };
