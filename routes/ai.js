const express = require("express");
const router = express.Router();

// ✅ Official OpenAI SDK (v4+)
const OpenAI = require("openai");

// ❗ Make sure OPENAI_API_KEY is in your .env
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/ai/chat
router.get("/", (req, res) => {
  res.send("AI route working ✅");
});
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message is required" });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // fast + cheap + good
      messages: [
        {
          role: "system",
          content:
            "You are a helpful, concise chat assistant. Keep answers short unless asked otherwise.",
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() || "No response";

    return res.json({ reply });
  } catch (err) {
    console.error("AI route error:", err?.message || err);

    return res.status(500).json({
      error: "AI request failed",
    });
  }
});

module.exports = router;