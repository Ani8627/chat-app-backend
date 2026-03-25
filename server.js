// ✅ FINAL PRODUCTION BACKEND (ALL FIXES APPLIED)

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
  io.emit("statusUpdated");
  

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
let users = new Map();
let groups = new Map();

// ================= SOCKET =================
io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  socket.on("addUser", ({ userId, username }) => {
  if (!users.has(userId)) {
    users.set(userId, new Set());
  }

  users.get(userId).add(socket.id);

  // ✅ STORE USERNAME ALSO
  socket.userId = userId;
  socket.username = username;

  // ✅ BUILD FULL USER LIST
  const userList = Array.from(users.keys()).map((id) => ({
    userId: id,
    username:
      Array.from(io.sockets.sockets.values()).find(s => s.userId === id)?.username || "User",
  }));

  io.emit("getUsers", userList);
});
  // ================= MESSAGE =================
 socket.on("sendMessage", (data) => {

  // ✅ FIX (ADD THESE 2 LINES)
  const receiver = users.get(data.receiverId);
  const sender = users.get(data.senderId);

  // ✅ SEND TO RECEIVER
  if (receiver) {
    io.to(receiver.socketId).emit("receiveMessage", data);
  }

  // ✅ SEND BACK TO SENDER (VERY IMPORTANT FOR SYNC)
  if (sender) {
    io.to(sender.socketId).emit("receiveMessage", data);
  }

});

  // ================= BLUE TICKS =================
  socket.on("markSeen", ({ senderId, receiverId }) => { // ✅ FIX
    const sender = users.get(senderId);

    if (sender) {
      io.to(sender.socketId).emit("messagesSeen", receiverId); // ✅ FIX
    }
  });

  // ================= GROUP =================
  socket.on("createGroup", ({ groupId, members }) => {
    groups.set(groupId, members);

    io.emit("groupCreated", { groupId, members });
  });
  io.emit("getUsers", Array.from(users.values())); // ✅ FIX

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
        fromUserId: [...users.entries()].find(([id, u]) => u.socketId === socket.id)?.[0], // ✅ FIX
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

  // ================= ICE =================
  socket.on("iceCandidate", ({ to, candidate }) => {
    const user = users.get(to);

    if (user) {
      io.to(user.socketId).emit("iceCandidate", candidate); // ✅ FIX
    }
  });

  // ================= DISCONNECT =================
 socket.on("disconnect", () => {
  const userId = socket.userId;

  if (userId && users.has(userId)) {
    users.get(userId).delete(socket.id);

    if (users.get(userId).size === 0) {
      users.delete(userId);
    }
  }

  const userList = Array.from(users.keys()).map((id) => ({
    userId: id,
    username:
      Array.from(io.sockets.sockets.values()).find(s => s.userId === id)?.username || "User",
  }));

  io.emit("getUsers", userList);
});
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("🔥 Server running on port", PORT);
});