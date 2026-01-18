import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ reply: "Method not allowed" });
    }

    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ reply: "Thiếu nội dung câu hỏi" });
        }

        const model = genAI.getGenerativeModel({
            model: "models/gemini-2.5-flash"
        });

        const result = await model.generateContent(
            `Bạn là AI tư vấn hướng nghiệp CNTT.
Trả lời bằng tiếng Việt, rõ ràng, dễ hiểu.

Câu hỏi: ${message}`
        );

        res.status(200).json({
            reply: result.response.text()
        });
    } catch (err) {
        console.error("Gemini error:", err);
        res.status(500).json({ reply: "Lỗi Gemini API" });
    }
}
