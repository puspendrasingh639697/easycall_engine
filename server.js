// // import { Server } from "socket.io";

// // const io = new Server(3000, {
// //   cors: 
// //   { origin: "*" },
// //   // 1. Performance: Ping/Pong timeout adjust for mobile stability
// //   pingTimeout: 60000,
// // });

// // // 2. User Mapping (In-memory for now, use Redis for 1M users)
// // const onlineUsers = new Map(); 

// // io.on("connection", (socket) => {
// //   console.log("New User:", socket.id);

// //   // User join event to map ID
// //   socket.on("register", (userId) => {
// //     onlineUsers.set(userId, socket.id);
// //   });

// //   socket.on("call-offer", (data) => {
// //     const targetSocketId = onlineUsers.get(data.targetId);
// //     if (targetSocketId) {
// //       socket.to(targetSocketId).emit("call-offer", { 
// //         offer: data.offer, 
// //         from: socket.id 
// //       });
// //     } else {
// //       socket.emit("error", { message: "User offline" });
// //     }
// //   });

// //   socket.on("call-answer", (data) => {
// //     const targetSocketId = onlineUsers.get(data.targetId);
// //     if (targetSocketId) {
// //       socket.to(targetSocketId).emit("call-answer", { answer: data.answer });
// //     }
// //   });

// //   socket.on("ice-candidate", (data) => {
// //     const targetSocketId = onlineUsers.get(data.targetId);
// //     if (targetSocketId) {
// //       socket.to(targetSocketId).emit("ice-candidate", { candidate: data.candidate });
// //     }
// //   });

// //   socket.on("disconnect", () => {
// //     // 3. Cleanup: Remove from map
// //     for (let [userId, socketId] of onlineUsers.entries()) {
// //       if (socketId === socket.id) {
// //         onlineUsers.delete(userId);
// //         break;
// //       }
// //     }
// //     console.log("User disconnected, cleaned up:", socket.id);
// //   });
// // });

// // server.js - Complete Fixed Version
// import { Server } from "socket.io";
// import { createServer } from "http";
// import express from "express";

// const app = express();
// const httpServer = createServer(app);

// // ✅ CORS configuration
// const io = new Server(httpServer, {
//   cors: {
//     origin: "*", // Production me specific domains use karein
//     methods: ["GET", "POST"]
//   },
//   pingTimeout: 60000,
//   pingInterval: 25000,
//   transports: ['websocket', 'polling'] // Fallback support
// });

// // ✅ In-memory store (Production me Redis use karein)
// const userStore = {
//   users: new Map(), // userId -> socketId
//   socketToUser: new Map(), // socketId -> userId
//   calls: new Map(), // callId -> {caller, callee, state}
// };

// // ✅ Rate limiting
// const rateLimiter = {
//   calls: new Map(), // socketId -> timestamp
//   maxCallsPerMinute: 10,
  
//   canMakeCall(socketId) {
//     const now = Date.now();
//     const userCalls = this.calls.get(socketId) || [];
//     const recentCalls = userCalls.filter(time => now - time < 60000);
    
//     if (recentCalls.length >= this.maxCallsPerMinute) {
//       return false;
//     }
    
//     recentCalls.push(now);
//     this.calls.set(socketId, recentCalls);
//     return true;
//   }
// };

// io.on("connection", (socket) => {
//   console.log(`🔌 New connection: ${socket.id}`);

//   // ✅ Register user with ID
//   socket.on("register", (userId) => {
//     if (!userId || typeof userId !== 'string') {
//       socket.emit("error", { message: "Invalid user ID" });
//       return;
//     }

//     // Remove old session if exists
//     if (userStore.users.has(userId)) {
//       const oldSocketId = userStore.users.get(userId);
//       if (oldSocketId !== socket.id) {
//         const oldSocket = io.sockets.sockets.get(oldSocketId);
//         if (oldSocket) {
//           oldSocket.emit("error", { message: "Logged in from another device" });
//           oldSocket.disconnect();
//         }
//         userStore.users.delete(userId);
//       }
//     }

//     userStore.users.set(userId, socket.id);
//     userStore.socketToUser.set(socket.id, userId);
    
//     console.log(`✅ User registered: ${userId} (${socket.id})`);
//     socket.emit("registered", { userId, socketId: socket.id });
//   });

//   // ✅ Call offer with validation
//   socket.on("call-offer", async (data) => {
//     try {
//       const { targetId, offer, from } = data;
      
//       // Validation
//       if (!targetId || !offer) {
//         socket.emit("error", { message: "Invalid call data" });
//         return;
//       }

//       const userId = userStore.socketToUser.get(socket.id);
//       if (!userId) {
//         socket.emit("error", { message: "User not registered" });
//         return;
//       }

//       // Rate limiting
//       if (!rateLimiter.canMakeCall(socket.id)) {
//         socket.emit("error", { message: "Rate limit exceeded" });
//         return;
//       }

//       const targetSocketId = userStore.users.get(targetId);
//       if (!targetSocketId) {
//         socket.emit("error", { message: "User offline" });
//         return;
//       }

//       // Store call
//       const callId = `${userId}-${targetId}-${Date.now()}`;
//       userStore.calls.set(callId, {
//         caller: userId,
//         callee: targetId,
//         state: 'ringing',
//         startTime: Date.now()
//       });

//       // Forward offer
//       io.to(targetSocketId).emit("call-offer", {
//         from: userId,
//         offer,
//         callId
//       });

//       console.log(`📞 Call from ${userId} to ${targetId}`);
//       socket.emit("call-initiated", { callId, targetId });
      
//     } catch (err) {
//       console.error("Call offer error:", err);
//       socket.emit("error", { message: "Call failed" });
//     }
//   });

//   // ✅ Call answer
//   socket.on("call-answer", (data) => {
//     try {
//       const { targetId, answer } = data;
      
//       if (!targetId || !answer) {
//         socket.emit("error", { message: "Invalid answer data" });
//         return;
//       }

//       const targetSocketId = userStore.users.get(targetId);
//       if (targetSocketId) {
//         io.to(targetSocketId).emit("call-answer", { answer });
//         console.log(`✅ Call answered by ${socket.id} to ${targetId}`);
//       }
//     } catch (err) {
//       console.error("Call answer error:", err);
//       socket.emit("error", { message: "Answer failed" });
//     }
//   });

//   // ✅ ICE candidate with validation
//   socket.on("ice-candidate", (data) => {
//     try {
//       const { targetId, candidate } = data;
      
//       if (!targetId || !candidate) {
//         return; // Silent fail for ICE
//       }

//       const targetSocketId = userStore.users.get(targetId);
//       if (targetSocketId) {
//         io.to(targetSocketId).emit("ice-candidate", { candidate });
//       }
//     } catch (err) {
//       // ICE errors are non-critical
//       console.debug("ICE candidate error:", err);
//     }
//   });

//   // ✅ Disconnect cleanup
//   socket.on("disconnect", () => {
//     const userId = userStore.socketToUser.get(socket.id);
    
//     if (userId) {
//       // Clean up active calls
//       for (const [callId, call] of userStore.calls.entries()) {
//         if (call.caller === userId || call.callee === userId) {
//           userStore.calls.delete(callId);
//           // Notify other party
//           const otherParty = call.caller === userId ? call.callee : call.caller;
//           const otherSocketId = userStore.users.get(otherParty);
//           if (otherSocketId) {
//             io.to(otherSocketId).emit("call-ended", { 
//               reason: "other_party_disconnected" 
//             });
//           }
//         }
//       }

//       // Remove from stores
//       userStore.users.delete(userId);
//       userStore.socketToUser.delete(socket.id);
//       console.log(`👋 User disconnected: ${userId}`);
//     }
//   });

//   // ✅ Heartbeat for connection health
//   socket.on("ping", () => {
//     socket.emit("pong");
//   });
// });

// // ✅ Health check endpoint
// app.get("/health", (req, res) => {
//   res.json({
//     status: "ok",
//     connections: io.engine.clientsCount,
//     users: userStore.users.size,
//     calls: userStore.calls.size,
//     uptime: process.uptime()
//   });
// });

// const PORT = process.env.PORT || 3000;
// httpServer.listen(PORT, () => {
//   console.log(`🚀 Signaling server running on port ${PORT}`);
//   console.log(`📊 Server stats: http://localhost:${PORT}/health`);
// });

// export { io, userStore };

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

// ✅ CORS enabled for ALL origins
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use(express.static('.'));

// ✅ Socket.IO with CORS
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type"]
    },
    transports: ['websocket', 'polling']
});

// Store users with better management
const users = new Map();
const socketToUser = new Map();

io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);
    
    // ✅ Register with better handling
    socket.on('register', (userId) => {
        // Check if user already exists
        if (users.has(userId)) {
            const oldSocketId = users.get(userId);
            // Notify old socket
            if (oldSocketId !== socket.id) {
                const oldSocket = io.sockets.sockets.get(oldSocketId);
                if (oldSocket) {
                    oldSocket.emit('error', { message: 'Logged in from another device' });
                    oldSocket.disconnect();
                }
                // Remove old entry
                users.delete(userId);
                socketToUser.delete(oldSocketId);
            }
        }
        
        // Register new user
        users.set(userId, socket.id);
        socketToUser.set(socket.id, userId);
        socket.userId = userId;
        
        console.log(`📝 User registered: ${userId} (${socket.id})`);
        socket.emit('registered', { userId, socketId: socket.id });
    });
    
    // Call offer
    socket.on('call-offer', (data) => {
        console.log(`📞 Call offer from: ${data.from} to: ${data.targetId}`);
        const targetSocketId = users.get(data.targetId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('call-offer', {
                from: data.from,
                offer: data.offer
            });
        } else {
            socket.emit('error', { message: 'User offline' });
        }
    });
    
    // Call answer
    socket.on('call-answer', (data) => {
        console.log(`✅ Call answer from: ${socket.userId} to: ${data.targetId}`);
        const targetSocketId = users.get(data.targetId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('call-answer', {
                answer: data.answer
            });
        }
    });
    
    // ICE candidate
    socket.on('ice-candidate', (data) => {
        const targetSocketId = users.get(data.targetId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('ice-candidate', {
                candidate: data.candidate
            });
        }
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        if (socket.userId) {
            users.delete(socket.userId);
            socketToUser.delete(socket.id);
            console.log(`❌ User disconnected: ${socket.userId}`);
        }
    });
});

// ✅ Health check with CORS
app.get('/health', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.json({
        status: 'ok',
        connections: io.engine.clientsCount,
        users: users.size,
        uptime: process.uptime()
    });
});

const PORT = 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('═══════════════════════════════════════');
    console.log('🚀 Server is RUNNING!');
    console.log(`📱 URL: http://localhost:${PORT}`);
    console.log(`📱 URL: http://127.0.0.1:${PORT}`);
    console.log('📝 Open test.html in TWO tabs');
    console.log('═══════════════════════════════════════');
});