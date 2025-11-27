// backend/src/routes/socket.ts
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Server } from "socket.io";

interface ChatMessage {
  from: number;
  text: string;
  at: string;
}

// ✅ Plus d'export de onlineUsers ici
// Tout sera stocké dans fastify.decorate("onlineUsers", ...)

export const setupSocket = fp(async (fastify: FastifyInstance) => {
  const io = new Server(fastify.server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true,
    },
  });

  // On crée une Map pour les users en ligne et on la stocke dans fastify
  const onlineUsers = new Map<number, string>();
  (fastify as any).io = io;
  (fastify as any).onlineUsers = onlineUsers;

  io.on("connection", async (socket) => {
    let userId: number | null = null;

    // --- Auth via JWT ---
    try {
      const token =
        (socket.handshake.auth && (socket.handshake.auth as any).token) ||
        (typeof socket.handshake.headers.authorization === "string"
          ? socket.handshake.headers.authorization.replace("Bearer ", "")
          : null);

      if (!token) {
        socket.disconnect(true);
        return;
      }

      const decoded = await (fastify as any).jwt.verify(token);
      userId = decoded.id || decoded.userId || decoded.sub;
      if (!userId) {
        socket.disconnect(true);
        return;
      }
    } catch (err) {
      fastify.log.error({ err }, "Socket auth failed");
      socket.disconnect(true);
      return;
    }

    // --- Gestion des users en ligne ---
    onlineUsers.set(userId, socket.id);
    io.emit("user:online", { userId });
    fastify.log.info({ userId }, "Socket connected");

    // --- Chat lié au match ---
    socket.on("joinMatchChat", (matchId: number) => {
      if (!matchId) return;
      const room = `match_${matchId}`;
      socket.join(room);
      fastify.log.info({ userId, matchId }, "Joined match chat");
    });

    socket.on(
      "chat:message",
      (payload: { matchId: number; text: string }) => {
        if (!payload || !payload.matchId || !payload.text) return;

        const room = `match_${payload.matchId}`;
        const msg: ChatMessage = {
          from: userId!,
          text: payload.text.toString().slice(0, 500),
          at: new Date().toISOString(),
        };

        io.to(room).emit("chat:message", msg);
      }
    );
    // retourner les amis en ligne
    socket.on("get:onlineFriends", (friendsIds: number[]) => {
    if (!Array.isArray(friendsIds)) return;
    const online = friendsIds.filter(id => onlineUsers.has(id));

    // Send the list back only to the requester
    socket.emit("onlineFriends", online);
  });
    // --- Déconnexion ---
    socket.on("disconnect", () => {
      onlineUsers.delete(userId!);
      io.emit("user:offline", { userId });
      fastify.log.info({ userId }, "Socket disconnected");
    });
  });
});
