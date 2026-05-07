# 🤖 Discord Point Counter Bot (บอทนับแต้ม)

บอท Discord ที่ใช้ AI อ่านข้อความแบบฟอร์มแล้วนับแต้ม/เงินอัตโนมัติ พร้อมสแกนข้อความย้อนหลังได้

## ✨ ฟีเจอร์

- 🤖 **AI นับแต้ม** — ใช้ Groq (Llama 3.3 70B) อ่านข้อความแบบฟอร์มและดึงจำนวนแต้มออกมา (ฟรี!)
- 📝 **Regex Fallback** — ถ้าไม่มี Groq API Key จะใช้ regex ในการดึงข้อมูล
- 🔄 **สแกนย้อนหลัง** — สแกนข้อความเก่าในช่องได้สูงสุด 5,000 ข้อความ
- 📊 **Leaderboard** — อันดับแต้มสูงสุด
- ⚡ **นับอัตโนมัติ** — ตั้งช่องให้บอทคอยนับแต้มจากข้อความใหม่อัตโนมัติ
- 💾 **SQLite Database** — เก็บข้อมูลในไฟล์ ไม่ต้องตั้ง database server

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
# ติดตั้ง dependencies
npm install

# คัดลอกไฟล์ตั้งค่า
copy .env.example .env

# แก้ไข .env ใส่ Token และ Client ID
notepad .env
```

### 3. ตั้งค่า .env

```env
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_client_id_here
GROQ_API_KEY=your_groq_api_key_here   # ไม่บังคับ (ฟรี!)
```

### 4. รันบอท

```bash
npm start
```

## 📌 คำสั่ง Slash Commands

| คำสั่ง | คำอธิบาย | สิทธิ์ |
|--------|----------|--------|
| `/scan` | สแกนข้อความย้อนหลังเพื่อนับแต้ม | Manage Messages |
| `/points` | ดูแต้มทั้งหมด หรือระบุชื่อผู้ใช้ | ทุกคน |
| `/leaderboard` | อันดับแต้มสูงสุด | ทุกคน |
| `/setchannel` | ตั้งช่องนับแต้มอัตโนมัติ | Manage Channels |
| `/clearpoints` | ล้างแต้มทั้งหมด | Administrator |
| `/pointhelp` | วิธีใช้บอท | ทุกคน |

## 📝 รูปแบบข้อความที่บอทรองรับ

บอทจะอ่านข้อความที่มีรูปแบบคล้ายนี้:

```
ส่งงานฟาร์มเงินเข้ากรม
[ Name ] : Qu33n_y3
[ Name discord ] : @พลเกษตรธิการ(ผ.) | Qu33hn_y3
[ ยศกรม ] :พลเกษตรธิการฝึกหัด
[ จ่ายกี่บาท ? ] :17000
[ ฝ่ายบัญชีรับเงินรึยัง ? ] :รับแล้วค่ะ
```

บอทจะดึง **17,000** แต้ม ให้กับ **Qu33n_y3** โดยอัตโนมัติ

## 🔧 โหมดทำงาน

### โหมด AI (แนะนำ)
ถ้ามี `GROQ_API_KEY` บอทจะใช้ Llama 3.3 70B ผ่าน Groq วิเคราะห์ข้อความ ได้ผลแม่นยำกว่า + **ฟรี!**

### โหมด Regex (ไม่ต้องใช้ API)
ถ้าไม่มี API Key บอทจะใช้ regex pattern matching ดึงข้อมูลจากข้อความ ทำงานเร็วกว่าแต่อาจพลาดบางรูปแบบ
