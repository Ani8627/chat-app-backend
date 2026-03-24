require("dotenv").config();

console.log("🚀 SERVER STARTING...");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const helmet = require("helmet");
const { Server } = require("socket.io");

// ROUTES
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const uploadRoute = require("./routes/upload");
const aiRoute = require("./routes/ai");

// CREATE APP
const app = express();

// 🔐 SECURITY
app.use(helmet());

// 🌐 CORS
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

// ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", uploadRoute);
app.use("/api/ai", aiRoute);

// HEALTH CHECK
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// STATIC
app.use("/uploads", express.static("uploads"));

// DATABASE
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected 🧠"))
  .catch(err => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

// SERVER
const server = http.createServer(app);

// SOCKET
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let users = [];

// SOCKET EVENTS
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  // 📹 CALL
  socket.on("callUser", ({ to, offer }) => {
    const user = users.find(u => u.userId === to);
    if (user) {
      io.to(user.socketId).emit("incomingCall", {
        from: socket.id,
        offer,
      });
    }
  });

  socket.on("answerCall", ({ to, answer }) => {
    io.to(to).emit("callAnswered", { answer });
  });

  // ⌨ TYPING
  socket.on("typing", ({ senderId, receiverId }) => {
    const receiver = users.find(u => u.userId === receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit("typing", senderId);
    }
  });

  // ✔✔ SEEN
  socket.on("markSeen", async ({ senderId, receiverId }) => {
    try {
      const Message = require("./models/Message");

      await Message.updateMany(
        { senderId, receiverId, seen: false },
        { $set: { seen: true } }
      );

      const sender = users.find(u => u.userId === senderId);
      if (sender) {
        io.to(sender.socketId).emit("messagesSeen", receiverId);
      }

    } catch (err) {
      console.error("Seen error:", err.message);
    }
  });

  // 👤 ADD USER (🔥 FIXED)
  socket.on("addUser", ({ userId, username }) => {
    const existingUser = users.find(u => u.userId === userId);

    if (existingUser) {
      existingUser.socketId = socket.id;
    } else {
      users.push({
        userId,
        username: username || "User",
        socketId: socket.id,
      });
    }

    // remove duplicates (extra safety)
    users = users.filter(
      (v, i, a) => a.findIndex(t => t.userId === v.userId) === i
    );

    io.emit("getUsers", users);
  });

  // 💬 MESSAGE (🔥 IMPROVED)
  socket.on("sendMessage", (data) => {
    const sender = users.find(u => u.userId === data.senderId);
    const receiver = users.find(u => u.userId === data.receiverId);

    const enrichedMessage = {
      ...data,
      senderName: sender?.username || "User",
    };

    if (receiver) {
      io.to(receiver.socketId).emit("receiveMessage", enrichedMessage);
    }

    socket.emit("receiveMessage", enrichedMessage);
  });

  // ❌ DISCONNECT
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    users = users.filter(u => u.socketId !== socket.id);
    io.emit("getUsers", users);
  });
});

// START SERVER
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});