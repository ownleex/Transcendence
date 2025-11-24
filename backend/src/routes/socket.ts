/*
import { FastifyInstance } from "fastify";
import { Server, Socket } from "socket.io";

// Store who is online (used in /friends endpoint)
export const onlineUsers = new Set<number>();

interface AuthenticatedSocket extends Socket {
    user?: { id: number };
}

export function setupSocket(fastify: FastifyInstance) {
    const io = new Server(fastify.server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Attach to Fastify instance
    fastify.decorate("io", io);

    io.on("connection", async (socket: AuthenticatedSocket) => {
        // --- Authenticate user from token ---
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization;
        if (!token) {
            socket.disconnect();
            return;
        }

        try {
            const decoded: any = fastify.jwt.verify(token.replace("Bearer ", ""));
            socket.user = { id: decoded.id };
        } catch {
            socket.disconnect();
            return;
        }

        const userId = socket.user.id;

        // Add user to online set
        onlineUsers.add(userId);
        console.log(`🟢 User ${userId} connected`);

        // Notify this socket about who is currently online
        socket.emit("onlineUsers:list", { users: Array.from(onlineUsers) });

        // Notify everyone else that this user is online
        io.emit("user:online", { userId });

        // --- Handle disconnect ---
        socket.on("disconnect", () => {
            onlineUsers.delete(userId);
            console.log(`🔴 User ${userId} disconnected`);
            io.emit("user:offline", { userId });
        });
    });
}
*/
import { FastifyInstance } from "fastify";
import { Server, Socket } from "socket.io";

// Store online users
export const onlineUsers = new Set<number>();

interface AuthenticatedSocket extends Socket {
    user?: { id: number };
}

export function setupSocket(fastify: FastifyInstance) {
    const io = new Server(fastify.server, {
        cors: { origin: "*", methods: ["GET", "POST"] },
    });

    // Attach to Fastify instance
    fastify.decorate("io", io);

    io.on("connection", async (socket: AuthenticatedSocket) => {
        // --- Authenticate user from token ---
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization;
        if (!token) {
            console.log("❌ Socket disconnected: no token");
            socket.disconnect();
            return;
        }

        try {
            const decoded: any = fastify.jwt.verify(token.replace("Bearer ", ""));
            socket.user = { id: decoded.id };
        } catch {
            console.log("❌ Socket disconnected: invalid token");
            socket.disconnect();
            return;
        }

        const userId = socket.user.id;
        onlineUsers.add(userId);

        console.log(`🟢 User ${userId} connected`);
        // Broadcast to all clients that this user is online
        io.emit("user:online", { userId });

        // --- Respond to client asking for which friends are online ---
        socket.on("get:onlineFriends", (friendIds: number[]) => {
            const onlineFriends = friendIds.filter(id => onlineUsers.has(id));
            socket.emit("onlineFriends", onlineFriends);
        });

        // --- On disconnect ---
        socket.on("disconnect", () => {
            onlineUsers.delete(userId);
            console.log(`🔴 User ${userId} disconnected`);
            io.emit("user:offline", { userId });
        });
    });
}
