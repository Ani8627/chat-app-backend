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

const Message = require("./models/Message"); // ✅ NEW

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
// ================= STATUS ROUTES =================

// ✅ ADDED
let statuses = [];

// ✅ ADD STATUS
app.post("/api/status", (req, res) => {
  const { userId, image } = req.body;

  statuses.push({
    userId,
    image,
    time: Date.now(),
  });

  res.json({ success: true });
});

// ✅ GET STATUS (last 24 hours)
app.get("/api/status", (req, res) => {
  const last24h = Date.now() - 24 * 60 * 60 * 1000;

  const filtered = statuses.filter((s) => s.time > last24h);

  res.json(filtered);
});

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

app.use("/uploads", express.static("uploads"));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log(err));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// ================= SOCKET FINAL FIX =================

let users = new Map(); // ✅ FIX (better than array)
let groups = new Map(); // ✅ FIX

io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  // ================= ADD USER =================
  socket.on("addUser", ({ userId, username }) => {
    users.set(userId, {
      userId,
      username,
      socketId: socket.id,
    });

    // ✅ SEND FULL CONSISTENT LIST
    io.emit(
      "getUsers",
      Array.from(users.values())
    );
  });

  // ================= SEND MESSAGE =================
  socket.on("sendMessage", (data) => {
    const receiver = users.get(data.receiverId);

    if (receiver) {
      io.to(receiver.socketId).emit("receiveMessage", data);
    }

    // ✅ ALSO SEND BACK TO SENDER (SYNC FIX)
    const sender = users.get(data.senderId);
    if (sender) {
      io.to(sender.socketId).emit("receiveMessage", data);
    }
  });
  // ✅ SEEN FIX
socket.on("markSeen", ({ senderId, receiverId }) => {
  const sender = users.get(senderId);
  if (sender) {
    io.to(sender.socketId).emit("messagesSeen", receiverId);
  }
});

  // ================= GROUP =================
  // ✅ FIX — GLOBAL GROUP STORAGE
let groups = new Map();

socket.on("createGroup", ({ groupId, members }) => {
  groups.set(groupId, members);

  // 🔥 BROADCAST GROUP TO ALL USERS
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

  // ================= ICE =================
  socket.on("iceCandidate", ({ to, candidate }) => {
    io.to(to).emit("iceCandidate", candidate);
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