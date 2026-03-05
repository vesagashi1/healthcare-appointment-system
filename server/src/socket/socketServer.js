const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

const initSocket = (httpServer) => {
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:5173"];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const rawToken =
        socket.handshake.auth?.token || socket.handshake.headers?.authorization;

      if (!rawToken) {
        return next(new Error("Authentication required"));
      }

      const token = rawToken.startsWith("Bearer ")
        ? rawToken.slice(7)
        : rawToken;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      return next();
    } catch (err) {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user?.id;
    if (userId) {
      socket.join(`user:${userId}`);
    }
  });

  return io;
};

const emitToUser = (userId, eventName, payload) => {
  if (!io || !userId) {
    return;
  }
  io.to(`user:${userId}`).emit(eventName, payload);
};

module.exports = {
  initSocket,
  emitToUser,
};
