import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ===== Chống spam theo IP (nhẹ, hợp Vercel) =====
const ipCooldown = new Map();
const COOLDOWN_MS = 3000; // 3 giây

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown";

  const now = Date.now();

  // ===== Rate limit đơn giản =====
  if (ipCooldown.has(ip) && now - ipCooldown.get(ip) < COOLDOWN_MS) {
    return res.status(429).json({
      reply: "⏳ Bạn gửi quá nhanh, vui lòng chờ vài giây rồi thử lại."
    });
  }
  ipCooldown.set(ip, now);

  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        reply: "Thiếu hoặc sai định dạng nội dung câu hỏi"
      });
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

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Gemini error:", err);

    // ===== HẾT QUOTA / RATE LIMIT =====
    if (err.status === 429) {
      return res.status(429).json({
        reply:
          "⚠️ AI đã đạt giới hạn hôm nay. Vui lòng thử lại sau hoặc quay lại ngày mai."
      });
    }

    return res.status(500).json({
      reply: "Lỗi Gemini API"
    });
  }
}
