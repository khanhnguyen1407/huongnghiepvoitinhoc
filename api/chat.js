import OpenAI from "openai";

// ===== DeepSeek client (OpenAI-compatible) =====
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com"
});

// ===== Simple rate limit theo IP (Vercel-friendly) =====
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

  // ===== Chống spam =====
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

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "Bạn là AI tư vấn hướng nghiệp CNTT. Trả lời bằng tiếng Việt, rõ ràng, dễ hiểu."
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.7
    });

    const reply = completion.choices[0].message.content;

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("DeepSeek error:", err);

    // ===== Bắt lỗi quota / rate limit =====
    if (err.status === 429) {
      return res.status(429).json({
        reply: "⚠️ AI đang bận hoặc bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau."
      });
    }

    return res.status(500).json({
      reply: "Lỗi DeepSeek API"
    });
  }
}