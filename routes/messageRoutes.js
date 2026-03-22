const router = require("express").Router()
const Message = require("../models/Message")

// SEND MESSAGE
// SAVE MESSAGE
router.post("/", async (req, res) => {
  try {
    const newMessage = new Message(req.body);
    const saved = await newMessage.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET CHAT BETWEEN TWO USERS
router.get("/:sender/:receiver", async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        {
          senderId: req.params.sender,
          receiverId: req.params.receiver,
        },
        {
          senderId: req.params.receiver,
          receiverId: req.params.sender,
        },
      ],
    });

    res.json(messages);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router