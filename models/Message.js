const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    senderId: String,
    receiverId: String,
    text: String,
    seen: { type: Boolean, default: false }
  },
  { timestamps: true } // 👈 MUST BE HERE
);

module.exports = mongoose.model("Message", MessageSchema);