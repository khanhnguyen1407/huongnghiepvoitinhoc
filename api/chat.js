import { GoogleGenerativeAI } from "@google/generative-ai";

// ===== Tạo 2 client Gemini =====
const genAI_PRIMARY = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

const genAI_FALLBACK = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY1
);

// ===== Chống spam nhẹ theo IP =====
const ipCooldown = new Map();
const COOLDOWN_MS = 3000;

async function askGemini(genAI, message) {
  const model = genAI.getGenerativeModel({
    model: "models/gemini-2.5-flash"
  });

  const result = await model.generateContent(
    `Bạn là AI tư vấn hướng nghiệp CNTT.
Trả lời bằng tiếng Việt, rõ ràng, dễ hiểu.

Câu hỏi: ${message}`
  );

  return result.response.text();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown";

  const now = Date.now();

  if (ipCooldown.has(ip) && now - ipCooldown.get(ip) < COOLDOWN_MS) {
    return res.status(429).json({
      reply: "⏳ Bạn gửi quá nhanh, vui lòng chờ vài giây."
    });
  }
  ipCooldown.set(ip, now);

  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        reply: "Thiếu hoặc sai nội dung câu hỏi"
      });
    }

    // ===== THỬ KEY CHÍNH =====
    try {
      const reply = await askGemini(genAI_PRIMARY, message);
      return res.status(200).json({ reply });
    } catch (err) {
      // Nếu KHÔNG phải lỗi quota → throw luôn
      if (err.status !== 429) throw err;

      console.warn("Primary Gemini key quota exceeded, switching key...");
    }

    // ===== THỬ KEY DỰ PHÒNG =====
    try {
      const reply = await askGemini(genAI_FALLBACK, message);
      return res.status(200).json({ reply });
    } catch (err) {
      if (err.status === 429) {
        return res.status(429).json({
          reply:
            "⚠️ Hệ thống AI đã đạt giới hạn hôm nay. Vui lòng quay lại sau."
        });
      }
      throw err;
    }
  } catch (err) {
    console.error("Gemini error:", err);
    return res.status(500).json({
      reply: "Lỗi Gemini API"
    });
  }
}
