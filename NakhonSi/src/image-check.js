// image-check.js - AI profile image 18+ checker using Groq vision
const { OpenAI } = require('openai');

let groqVision = null;

function initImageCheck(apiKey) {
  if (apiKey) {
    groqVision = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });
    console.log('✅ Image checker (AI vision) initialized');
  } else {
    console.log('⚠️ No GROQ_API_KEY — image check disabled (all images allowed)');
  }
}

/**
 * Check if a base64 image contains 18+ / explicit content
 * @param {string} base64Image - base64 encoded image data (no data URL prefix)
 * @param {string} mimeType - e.g. 'image/jpeg'
 * @returns {{ is18Plus: boolean, reason: string, confidence: number, blocked: boolean }}
 */
async function checkImage18Plus(base64Image, mimeType = 'image/jpeg') {
  if (!groqVision) {
    return { is18Plus: false, reason: 'AI not configured', confidence: 0, blocked: false };
  }

  try {
    const response = await groqVision.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a content moderation AI. Analyze this profile picture.
Does it contain nudity, sexual content, explicit adult (18+) material, or pornographic content?

Respond ONLY with valid JSON, no other text:
{"is18Plus": false, "reason": "safe image - normal profile photo", "confidence": 95}

Set is18Plus to true ONLY if you clearly detect explicit adult/sexual/pornographic content.
Normal photos, gaming avatars, anime characters, artwork are all safe.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 120,
      temperature: 0.1
    });

    const text = (response.choices[0]?.message?.content || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      const is18Plus = Boolean(result.is18Plus);
      return {
        is18Plus,
        reason: String(result.reason || ''),
        confidence: Number(result.confidence) || 0,
        blocked: is18Plus
      };
    }
    // Can't parse → allow (avoid false positives)
    return { is18Plus: false, reason: 'Could not parse AI response', confidence: 0, blocked: false };
  } catch (err) {
    console.error('Image check error:', err.message);
    // On AI error → don't block (avoid false positives breaking registration)
    return { is18Plus: false, reason: `AI error: ${err.message}`, confidence: 0, blocked: false };
  }
}

module.exports = { initImageCheck, checkImage18Plus };
