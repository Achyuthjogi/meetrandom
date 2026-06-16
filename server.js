/**
 * MeetRandom — Production Video Chat Server
 * 
 * Handles:
 *  - Static file serving
 *  - Socket.IO signaling for WebRTC
 *  - Random matchmaking queue
 *  - Text chat relay
 *  - Connection lifecycle management
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// ─── Serve Static Files ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── State ────────────────────────────────────────────────────────────────────
const waitingQueue = [];         // socket IDs waiting to be matched
const activeRooms = new Map();   // roomId -> { users: [socketId, socketId] }
const socketToRoom = new Map();  // socketId -> roomId
const onlineCount = { value: 0 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findPartner(socketId) {
  while (waitingQueue.length > 0) {
    const candidateId = waitingQueue.shift();
    const candidateSocket = io.sockets.sockets.get(candidateId);
    // Skip if candidate disconnected or is self
    if (!candidateSocket || candidateId === socketId) continue;
    // Skip if candidate is already in a room
    if (socketToRoom.has(candidateId)) continue;
    return candidateId;
  }
  return null;
}

function createRoom(socketId1, socketId2) {
  const roomId = uuidv4();
  activeRooms.set(roomId, { users: [socketId1, socketId2], createdAt: Date.now() });
  socketToRoom.set(socketId1, roomId);
  socketToRoom.set(socketId2, roomId);
  return roomId;
}

function destroyRoom(roomId) {
  const room = activeRooms.get(roomId);
  if (!room) return [];
  const users = room.users;
  users.forEach(uid => socketToRoom.delete(uid));
  activeRooms.delete(roomId);
  return users;
}

function getPartnerSocketId(socketId) {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return null;
  const room = activeRooms.get(roomId);
  if (!room) return null;
  return room.users.find(id => id !== socketId) || null;
}

function removeFromQueue(socketId) {
  const idx = waitingQueue.indexOf(socketId);
  if (idx !== -1) waitingQueue.splice(idx, 1);
}

function broadcastOnlineCount() {
  io.emit('online-count', onlineCount.value);
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  onlineCount.value++;
  broadcastOnlineCount();
  console.log(`[+] ${socket.id} connected (${onlineCount.value} online)`);

  // ── Find a match ──────────────────────────────────────────────────────────
  socket.on('find-partner', () => {
    // Clean up any existing room first
    const existingRoom = socketToRoom.get(socket.id);
    if (existingRoom) {
      const partnerId = getPartnerSocketId(socket.id);
      destroyRoom(existingRoom);
      if (partnerId) {
        const partnerSocket = io.sockets.sockets.get(partnerId);
        if (partnerSocket) partnerSocket.emit('partner-disconnected');
      }
    }
    removeFromQueue(socket.id);

    // Try to find a partner
    const partnerId = findPartner(socket.id);
    if (partnerId) {
      const roomId = createRoom(socket.id, partnerId);
      console.log(`[⚡] Matched ${socket.id} <-> ${partnerId} in room ${roomId}`);

      // Notify both — initiator creates the offer
      socket.emit('matched', { roomId, isInitiator: true });
      io.to(partnerId).emit('matched', { roomId, isInitiator: false });
    } else {
      // Join waiting queue
      waitingQueue.push(socket.id);
      socket.emit('waiting');
      console.log(`[⏳] ${socket.id} is waiting (queue: ${waitingQueue.length})`);
    }
  });

  // ── WebRTC Signaling ──────────────────────────────────────────────────────
  socket.on('webrtc-offer', (data) => {
    const partnerId = getPartnerSocketId(socket.id);
    if (partnerId) io.to(partnerId).emit('webrtc-offer', data);
  });

  socket.on('webrtc-answer', (data) => {
    const partnerId = getPartnerSocketId(socket.id);
    if (partnerId) io.to(partnerId).emit('webrtc-answer', data);
  });

  socket.on('webrtc-ice-candidate', (data) => {
    const partnerId = getPartnerSocketId(socket.id);
    if (partnerId) io.to(partnerId).emit('webrtc-ice-candidate', data);
  });

  // ── Text Chat ─────────────────────────────────────────────────────────────
  socket.on('chat-message', (msg) => {
    if (typeof msg !== 'string' || msg.trim().length === 0) return;
    const sanitized = msg.trim().slice(0, 500); // limit message length
    const partnerId = getPartnerSocketId(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('chat-message', { text: sanitized, from: 'stranger' });
      socket.emit('chat-message', { text: sanitized, from: 'you' });
    }
  });

  // ── Skip / Next ───────────────────────────────────────────────────────────
  socket.on('skip', () => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      const partnerId = getPartnerSocketId(socket.id);
      destroyRoom(roomId);
      if (partnerId) {
        const partnerSocket = io.sockets.sockets.get(partnerId);
        if (partnerSocket) partnerSocket.emit('partner-disconnected');
      }
    }
    removeFromQueue(socket.id);
  });

  // ── Stop ──────────────────────────────────────────────────────────────────
  socket.on('stop', () => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      const partnerId = getPartnerSocketId(socket.id);
      destroyRoom(roomId);
      if (partnerId) {
        const partnerSocket = io.sockets.sockets.get(partnerId);
        if (partnerSocket) partnerSocket.emit('partner-disconnected');
      }
    }
    removeFromQueue(socket.id);
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    onlineCount.value = Math.max(0, onlineCount.value - 1);
    broadcastOnlineCount();
    console.log(`[-] ${socket.id} disconnected (${onlineCount.value} online)`);

    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      const partnerId = getPartnerSocketId(socket.id);
      destroyRoom(roomId);
      if (partnerId) {
        const partnerSocket = io.sockets.sockets.get(partnerId);
        if (partnerSocket) partnerSocket.emit('partner-disconnected');
      }
    }
    removeFromQueue(socket.id);
  });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    online: onlineCount.value,
    waiting: waitingQueue.length,
    rooms: activeRooms.size,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 MeetRandom running at http://localhost:${PORT}\n`);
});
