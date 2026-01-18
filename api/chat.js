import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ====== SIMPLE CACHE (serverless-friendly) ======
const cache = new Map(); // key: message, value: reply
const CACHE_TTL = 1000 * 60 * 5; // 5 phút

// ====== RATE LIMIT THEO IP ======
const ipCooldown = new Map();
const COOLDOWN_MS = 3000; // 3 giây

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress;

  const now = Date.now();

  // ====== CHẶN SPAM ======
  if (ipCooldown.has(ip) && now - ipCooldown.get(ip) < COOLDOWN_MS) {
    return res.status(429).json({
      reply: "⏳ Bạn gửi quá nhanh, vui lòng chờ vài giây rồi thử lại."
    });
  }
  ipCooldown.set(ip, now);

  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ reply: "Thiếu nội dung câu hỏi" });
    }

    // ====== CACHE CHECK ======
    const cached = cache.get(message);
    if (cached && now - cached.time < CACHE_TTL) {
      return res.status(200).json({ reply: cached.reply });
    }

    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash"
    });

    const result = await model.generateContent(
      `Bạn là AI tư vấn hướng nghiệp CNTT.
Trả lời bằng tiếng Việt, rõ ràng, dễ hiểu.

Câu hỏi: ${message}`
    );

    const reply = result.response.text();

    // ====== SAVE CACHE ======
    cache.set(message, {
      reply,
      time: now
    });

    res.status(200).json({ reply });
  } catch (err) {
    console.error("Gemini error:", err);

    // ====== BẮT LỖI 429 ======
    if (err.status === 429) {
      return res.status(429).json({
        reply:
          "⚠️ Hệ thống đang quá tải hoặc đã hết lượt hôm nay. Vui lòng thử lại sau."
      });
    }

    res.status(500).json({ reply: "Lỗi Gemini API" });
  }
}