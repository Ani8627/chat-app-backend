require("dotenv").config();

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

// 🌐 CORS (PRODUCTION SAFE)
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", uploadRoute);
app.use("/api/ai", aiRoute);

// STATIC
app.use("/uploads", express.static("uploads"));

// DATABASE
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected 🧠"))
  .catch(err => console.log(err));

// SERVER
const server = http.createServer(app);

// SOCKET
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

let users = [];

// SOCKET EVENTS
io.on("connection", (socket) => {
  console.log("User connected ⚡");

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
    const Message = require("./models/Message");

    await Message.updateMany(
      { senderId, receiverId, seen: false },
      { $set: { seen: true } }
    );

    const sender = users.find(u => u.userId === senderId);
    if (sender) {
      io.to(sender.socketId).emit("messagesSeen", receiverId);
    }
  });

  // 👤 ADD USER (FIXED DUPLICATE ISSUE)
  socket.on("addUser", (userId) => {
    console.log("ADD USER:", userId);

    const exists = users.find((u) => u.userId === userId);

    if (!exists) {
      users.push({ userId, socketId: socket.id });
    } else {
      exists.socketId = socket.id; // update socket
    }

    io.emit("getUsers", users);
  });

  // 💬 MESSAGE
  socket.on("sendMessage", (data) => {
    const receiver = users.find(
      (user) => user.userId === data.receiverId
    );

    if (receiver) {
      io.to(receiver.socketId).emit("receiveMessage", data);
    }

    socket.emit("receiveMessage", data);
  });

  // ❌ DISCONNECT
  socket.on("disconnect", () => {
    console.log("User disconnected ❌");

    users = users.filter((user) => user.socketId !== socket.id);
    io.emit("getUsers", users);
  });
});

// START SERVER
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});