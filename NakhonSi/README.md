# 🤖 Discord Point Bot — เมืองนครศรีธรรมราช

บอท Discord ที่ใช้ AI อ่านแบบฟอร์มผลงาน/เข้าเวร แล้วนับแต้มอัตโนมัติ สำหรับเมืองนครศรีธรรมราช (Roblox RP)

## ✨ ฟีเจอร์

- 🤖 **AI นับแต้ม** — ใช้ Groq (Llama 3.1) อ่านแบบฟอร์มผลงาน/เข้าเวร (ฟรี!)
- 📝 **Regex Fallback** — ถ้าไม่มี Groq API Key จะใช้ regex
- 🔄 **สแกนย้อนหลัง** — สแกนข้อความเก่าได้สูงสุด 5,000 ข้อความ
- 📊 **Leaderboard** — อันดับแต้มสูงสุด
- ⚡ **นับอัตโนมัติ** — ตั้งช่องให้บอทคอยนับแต้มจากข้อความใหม่
- ➕ **เพิ่มแต้มด้วยตนเอง** — `/addpoints` สำหรับเพิ่มแต้มแบบ manual
- 💬 **คุยเล่น** — คุยกับ "ศรี" AI ผู้ช่วยเมืองนครศรีฯ
- 💾 **JSON Storage** — เก็บข้อมูลในไฟล์ ไม่ต้องตั้ง database server

## 📋 รูปแบบแบบฟอร์มที่รองรับ

### แบบผลงาน
```
𝐧𝐚𝐦𝐞 𝐫𝐨𝐛𝐥𝐨𝐱 ชื่อในเกม : TomAe145
𝐧𝐚𝐦𝐞 𝐃𝐢𝐬𝐜𝐨𝐫𝐝 ชื่อในดิส : @[ ๑ ] | TomAe145
กิจกรรมอะไร : รวมงานแต่ง
ผลงานนี้กี่แต้ม : 5
แต้มรวมทั้งหมดตอนนี้ : 10
ผลงานที่เท่าไหร่ : 2
รูปภาพหลักฐาน :
《ผู้ตรวจสอบ》: @[เจ้าเมือง] @[รองเจ้าเมือง] @[ปลัดเมือง]
```

### แบบเข้าเวร
```
𝐧𝐚𝐦𝐞 𝐫𝐨𝐛𝐥𝐨𝐱 ชื่อในเกม : jang230256
𝐧𝐚𝐦𝐞 𝐃𝐢𝐬𝐜𝐨𝐫𝐝 ชื่อในดิส : @[๑] | jang230256
ระยะเวลาการเข้าเวร : xxx
สถานการณ์ : ปกติ
คนที่ทหารทำการคุ้มกัน : @xxx
รูปหลักฐานการเข้าเวร :
《ผู้ตรวจสอบ》: @[เจ้าเมือง] @[รองเจ้าเมือง] @[ปลัดเมือง]
```

## 📋 ข้อกำหนด

- Node.js 18+
- Discord Bot Token
- (ไม่บังคับ) Groq API Key (ฟรี! สมัครที่ https://console.groq.com)

## 🚀 การติดตั้ง

### 1. สร้าง Discord Bot

1. ไปที่ [Discord Developer Portal](https://discord.com/developers/applications)
2. กด **New Application** → ตั้งชื่อ → กด **Create**
3. ไปที่แท็บ **Bot** → กด **Reset Token** → คัดลอก Token
4. เปิด **MESSAGE CONTENT INTENT** (สำคัญ!)
5. ไปที่แท็บ **OAuth2** → คัดลอก **Client ID**
6. ใช้ URL นี้เชิญบอทเข้าเซิร์ฟเวอร์:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877975552&scope=bot%20applications.commands
   ```

### 2. ตั้งค่าโปรเจกต์

```bash
npm install
copy .env.example .env
# แก้ไข .env ใส่ Token และ Client ID
```

### 3. ตั้งค่า .env

```env
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_client_id_here
GROQ_API_KEY=your_groq_api_key_here
```

### 4. รันบอท

```bash
npm start
```

## 📌 คำสั่ง Slash Commands

| คำสั่ง | คำอธิบาย |
|--------|----------|
| `/points` | ดูแต้มทั้งหมด |
| `/points user:ชื่อ` | ดูแต้มของคนใดคนหนึ่ง |
| `/leaderboard` | อันดับแต้มสูงสุด |
| `/scan` | สแกนข้อความย้อนหลัง |
| `/setchannel` | ตั้งช่องนับแต้มอัตโนมัติ |
| `/addpoints` | เพิ่มแต้มด้วยตนเอง |
| `/setchat` | ตั้งช่องคุยเล่นกับบอท |
| `/unsetchat` | ปิดช่องคุยเล่น |
| `/clearpoints` | ล้างแต้มทั้งหมด (Admin) |
| `/pointhelp` | วิธีใช้งาน |

## 🚀 Deploy บน Railway

1. Push โค้ดขึ้น GitHub
2. ไปที่ [Railway](https://railway.app) → New Project → Deploy from GitHub
3. เพิ่ม Environment Variables: `DISCORD_TOKEN`, `CLIENT_ID`, `GROQ_API_KEY`
4. Deploy!
