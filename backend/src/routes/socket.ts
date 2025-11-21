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
    //fastify.decorate("onlineUsers", onlineUsers);

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
        onlineUsers.add(userId);

        console.log(`🟢 User ${userId} connected`);
        io.emit("user:online", { userId });

        // --- On disconnect ---
        socket.on("disconnect", () => {
            onlineUsers.delete(userId);
            console.log(`🔴 User ${userId} disconnected`);
            io.emit("user:offline", { userId });
        });
    });
}
