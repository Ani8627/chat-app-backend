require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const helmet = require("helmet");
const { Server } = require("socket.io");

const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const uploadRoute = require("./routes/upload");
const aiRoute = require("./routes/ai");

const app = express();

app.use(helmet());
app.use(express.json());
//cors with credentials for cookies
app.use(cors({
  origin: true,
  credentials: true
}));

// ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", uploadRoute);
app.use("/api/ai", aiRoute);

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

app.use("/uploads", express.static("uploads"));

// DB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log(err));

const server = http.createServer(app);

// ✅ SOCKET FINAL
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

let users = [];
let groups = {};

io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  // ADD USER
  socket.on("addUser", ({ userId, username }) => {
    const existing = users.find((u) => u.userId === userId);

    if (existing) {
      existing.socketId = socket.id;
    } else {
      users.push({ userId, username, socketId: socket.id });
    }

    io.emit("getUsers", users);
  });

  // MESSAGE
  socket.on("sendMessage", (data) => {
    const receiver = users.find((u) => u.userId === data.receiverId);

    if (receiver) {
      io.to(receiver.socketId).emit("receiveMessage", data);
    }
  });

  // BLUE TICKS
  socket.on("markSeen", ({ senderId, receiverId }) => {
    const sender = users.find((u) => u.userId === senderId);
    if (sender) {
      io.to(sender.socketId).emit("messageSeen", receiverId);
    }
  });

  // TYPING
  socket.on("typing", ({ senderId, receiverId }) => {
    const receiver = users.find((u) => u.userId === receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit("typing", senderId);
    }
  });

  // VIDEO CALL
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

  // GROUP CHAT
  socket.on("createGroup", ({ groupId, members }) => {
    groups[groupId] = members;
  });

  socket.on("sendGroupMessage", ({ groupId, message }) => {
    const members = groups[groupId] || [];

    members.forEach((id) => {
      const user = users.find((u) => u.userId === id);
      if (user) {
        io.to(user.socketId).emit("receiveGroupMessage", {
          groupId,
          message,
        });
      }
    });
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    const disconnected = users.find((u) => u.socketId === socket.id);
    users = users.filter((u) => u.socketId !== socket.id);

    if (disconnected) {
      io.emit("userOffline", disconnected.userId);
    }

    io.emit("getUsers", users);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("🔥 Server running on port", PORT);
});