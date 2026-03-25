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

app.use(cors({
  origin: true,
  credentials: true
}));

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", uploadRoute);
app.use("/api/ai", aiRoute);

// ================= STATUS =================
let statuses = [];

app.post("/api/status", (req, res) => {
  const { userId, image } = req.body;

  statuses.push({
    userId,
    image,
    time: Date.now(),
  });

  res.json({ success: true });
});

app.get("/api/status", (req, res) => {
  const last24h = Date.now() - 24 * 60 * 60 * 1000;
  res.json(statuses.filter((s) => s.time > last24h));
});

app.use("/uploads", express.static("uploads"));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log(err));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// ================= STORAGE =================
let users = new Map();     // ✅ FIX
let groups = new Map();    // ✅ FIX (ONLY ONCE)

// ================= SOCKET =================
io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  // ================= ADD USER =================
  socket.on("addUser", ({ userId, username }) => {
    users.set(userId, {
      userId,
      username,
      socketId: socket.id,
    });

    io.emit("getUsers", Array.from(users.values()));
  });

  // ================= MESSAGE =================
  socket.on("sendMessage", (data) => {
    const receiver = users.get(data.receiverId);
    const sender = users.get(data.senderId);

    // ✅ SEND TO RECEIVER
    if (receiver) {
      io.to(receiver.socketId).emit("receiveMessage", data);
    }

    // ✅ SEND BACK TO SENDER (SYNC FIX)
    if (sender) {
      io.to(sender.socketId).emit("receiveMessage", data);
    }
  });

  // ================= BLUE TICKS =================
  socket.on("markSeen", ({ senderId }) => {
    const sender = users.get(senderId);

    if (sender) {
      io.to(sender.socketId).emit("messagesSeen", senderId);
    }
  });

  // ================= GROUP =================
  socket.on("createGroup", ({ groupId, members }) => {
    groups.set(groupId, members);

    // ✅ BROADCAST GROUP TO ALL USERS
    io.emit("groupCreated", { groupId, members });
  });

  socket.on("sendGroupMessage", ({ groupId, message }) => {
    const members = groups.get(groupId) || [];

    members.forEach((id) => {
      const user = users.get(id);
      if (user) {
        io.to(user.socketId).emit("receiveGroupMessage", {
          groupId,
          message,
        });
      }
    });
  });

  // ================= CALL =================
  socket.on("callUser", ({ to, offer }) => {
    const user = users.get(to);

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

  socket.on("rejectCall", ({ to }) => {
    io.to(to).emit("callRejected");
  });

  // ================= ICE FIX =================
  socket.on("iceCandidate", ({ to, candidate }) => {
    const user = users.get(to);

    if (user) {
      io.to(user.socketId).emit("iceCandidate", candidate);
    }
  });

  // ================= DISCONNECT =================
  socket.on("disconnect", () => {
    for (let [key, value] of users.entries()) {
      if (value.socketId === socket.id) {
        users.delete(key);
      }
    }

    io.emit("getUsers", Array.from(users.values()));
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("🔥 Server running on port", PORT);
});