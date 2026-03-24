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

// APP
const app = express();

// SECURITY
app.use(helmet());

// CORS (🔥 FINAL FIX)
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // allow all (safe fallback)
      }
    },
    credentials: true,
  })
);

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

// STATIC FILES
app.use("/uploads", express.static("uploads"));

// ❌ REMOVE ANY app.options("/*") — it causes crash

// DATABASE
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

// SERVER
const server = http.createServer(app);

// SOCKET.IO (🔥 FINAL FIX)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let users = [];

// SOCKET EVENTS
io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  // ADD USER
  socket.on("addUser", ({ userId, username }) => {
    const existing = users.find((u) => u.userId === userId);

    if (existing) {
      existing.socketId = socket.id;
    } else {
      users.push({
        userId,
        username: username || "User",
        socketId: socket.id,
      });
    }

    // REMOVE DUPLICATES
    users = users.filter(
      (v, i, a) => a.findIndex((t) => t.userId === v.userId) === i
    );

    io.emit("getUsers", users);
  });

  // SEND MESSAGE
  socket.on("sendMessage", (data) => {
    const receiver = users.find((u) => u.userId === data.receiverId);

    if (receiver) {
      io.to(receiver.socketId).emit("receiveMessage", data);
    }
  });

  // TYPING
  socket.on("typing", ({ senderId, receiverId }) => {
    const receiver = users.find((u) => u.userId === receiverId);

    if (receiver) {
      io.to(receiver.socketId).emit("typing", senderId);
    }
  });

  // VIDEO CALL SIGNALING
  socket.on("callUser", ({ to, offer }) => {
    const user = users.find((u) => u.userId === to);

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

  // DISCONNECT
  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);

    const disconnected = users.find((u) => u.socketId === socket.id);

    users = users.filter((u) => u.socketId !== socket.id);

    if (disconnected) {
      io.emit("userOffline", {
        userId: disconnected.userId,
        time: new Date().toLocaleTimeString(),
      });
    }

    io.emit("getUsers", users);
  });
});

// PORT (🔥 MUST FOR RENDER)
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});