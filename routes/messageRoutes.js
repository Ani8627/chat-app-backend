const router = require("express").Router();
const Message = require("../models/Message");

// ✅ SEND MESSAGE
router.post("/", async (req, res) => {
  try {
    console.log("📩 BODY:", req.body);

    // ✅ FORCE SAFE VALUES
    const senderId = String(req.body.senderId || "");
    const receiverId = String(req.body.receiverId || "");
    const text = String(req.body.text || "");
    const type = req.body.type || "text";
    const seen = req.body.seen ?? false;

    if (!senderId || !receiverId) {
      return res.status(400).json({ error: "Missing IDs" });
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      type,
      seen,
    });

    const saved = await newMessage.save();

    res.status(200).json(saved);

  } catch (err) {
    console.error("❌ FULL ERROR:", err); // THIS WILL SHOW REAL ISSUE
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET MESSAGES
router.get("/:senderId/:receiverId", async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        {
          senderId: req.params.senderId,
          receiverId: req.params.receiverId,
        },
        {
          senderId: req.params.receiverId,
          receiverId: req.params.senderId,
        },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (err) {
    console.error("❌ FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;