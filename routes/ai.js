const express = require("express");
const axios = require("axios");

const router = express.Router();

// Try a list of models in order until one works
const MODELS = [
  "google/gemma-7b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "meta-llama/llama-3-8b-instruct"
];

async function callOpenRouter(message) {
  for (const model of MODELS) {
    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
          messages: [{ role: "user", content: message }],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );

      const reply = res?.data?.choices?.[0]?.message?.content;
      if (reply) return reply;

    } catch (err) {
      // Try next model
      console.warn(`Model failed: ${model}`, err.response?.data || err.message);
    }
  }

  // If all models fail → return a safe fallback
  return "⚠️ AI is temporarily unavailable. Please try again later.";
}

router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const reply = await callOpenRouter(message);

    res.json({ reply });

  } catch (err) {
    console.error("AI ROUTE ERROR:", err.message);

    res.status(500).json({
      error: "AI request failed",
    });
  }
});

module.exports = router;