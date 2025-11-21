import { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import WS from "ws";

interface GameQuery { matchId: string; userId: string; }

interface GameState2P {
    mode: 2;
    paddles: { p1: number; p2: number };
    ball: { x: number; y: number; vx: number; vy: number };
}
interface GameState4P {
    mode: 4;
    paddles: { p1: number; p2: number; p3: number; p4: number };
    ball: { x: number; y: number; vx: number; vy: number };
}
type GameState = GameState2P | GameState4P;

interface Match {
    matchId: number;
    mode: 2 | 4;
    players: number[];
    sockets: Map<number, WS>;
    state: GameState;
}

// ---------------------------
// State
// ---------------------------
const matches = new Map<number, Match>();

// Matchmaking queues
let duoQueue: number[] = [];
let quadQueue: number[] = [];
let duoStatus: Record<number, number> = {};
let quadStatus: Record<number, number> = {};

// ---------------------------
// Create Match
// ---------------------------
export function createMatch(matchId: number, mode: 2 | 4, players: number[]) {
    const baseBall = { x: 400, y: 300, vx: 300, vy: 200 };
    const state: GameState = mode === 2
        ? { mode: 2, paddles: { p1: 300, p2: 300 }, ball: { ...baseBall } }
        : { mode: 4, paddles: { p1: 300, p2: 300, p3: 300, p4: 300 }, ball: { ...baseBall } };
    const match: Match = { matchId, mode, players, sockets: new Map(), state };
    matches.set(matchId, match);
    return match;
}

// ---------------------------
// Matchmaking
// ---------------------------
export function joinDuoQueue(userId: number): number {
    if (duoQueue.length > 0) {
        const opponentId = duoQueue.shift()!;
        const matchId = Date.now();
        createMatch(matchId, 2, [opponentId, userId]);
        duoStatus[opponentId] = matchId;
        duoStatus[userId] = matchId;
        return matchId;
    } else {
        duoQueue.push(userId);
        return -1;
    }
}

export function joinQuadQueue(userId: number): number {
    // Add the player into the queue
    quadQueue.push(userId);

    // If we reached 4 players, create a match
    if (quadQueue.length >= 4) {
        const players = quadQueue.splice(0, 4);
        const matchId = Date.now();

        // Create match object
        createMatch(matchId, 4, players);

        // Store match ID for ALL 4 users
        players.forEach(id => {
            quadStatus[id] = matchId;
        });

        // Return matchId ONLY for the player who triggered the match
        return matchId;
    }

    // Not enough players yet → "keep waiting"
    return -1;
}


// ---------------------------
// WebSocket Setup
// ---------------------------
export function setupGameWS(fastify: FastifyInstance) {
    fastify.register(websocket);

    fastify.get<{ Querystring: GameQuery }>(
        "/game",
        { websocket: true },
        (conn, req) => {
            const socket: WS = (conn as any).socket;
            const matchId = Number(req.query.matchId);
            const userId = Number(req.query.userId);

            const match = matches.get(matchId);
            if (!match) {
                socket.send(JSON.stringify({ type: "error", message: "Match not found" }));
                return socket.close();
            }

            match.sockets.set(userId, socket);
            console.log(`User ${userId} joined match ${matchId}`);

            socket.send(JSON.stringify({ type: "state", state: match.state }));

            socket.on("message", (raw: any) => {
                const data = JSON.parse(raw.toString());

                if (data.type === "paddle" && match.players.includes(userId)) {
                    const index = match.players.indexOf(userId) + 1;

                    if (match.state.mode === 2) {
                        (match.state.paddles as any)[`p${index}`] = data.value; // only vertical
                    } else {
                        if (index <= 2 && data.axis === "y") {
                            (match.state.paddles as any)[`p${index}`] = data.value;
                        }
                        if (index >= 3 && data.axis === "x") {
                            (match.state.paddles as any)[`p${index}`] = data.value;
                        }
                    }

                }
            });
            socket.on("close", () => { match.sockets.delete(userId); });
        }
    );

    // Physics loop
    setInterval(() => {
        for (const match of matches.values()) {
            const b = match.state.ball;
            b.x += b.vx * 0.016;
            b.y += b.vy * 0.016;
            if (b.y < 0 || b.y > 600) b.vy *= -1;
            if (b.x < 0 || b.x > 800) b.vx *= -1;

            const msg = JSON.stringify({ type: "state", state: match.state });
            for (const socket of match.sockets.values()) {
                if (socket.readyState === WS.OPEN) socket.send(msg);
            }
        }
    }, 16);

    // ---------------------------
    // API endpoints
    // ---------------------------
    fastify.post<{ Body: { userId: number } }>("/api/join-duo", async (req) => {
        const matchId = joinDuoQueue(req.body.userId);
        if (matchId === -1) return { ok: true, status: "waiting" };
        return { ok: true, status: "matched", matchId };
    });

    fastify.get<{ Querystring: { userId: string } }>("/api/join-duo/status", async (req) => {
        const userId = Number(req.query.userId);
        if (duoStatus[userId]) {
            const matchId = duoStatus[userId];
            delete duoStatus[userId];
            return { ok: true, status: "matched", matchId };
        }
        return { ok: true, status: "waiting" };
    });

    fastify.post<{ Body: { userId: number } }>("/api/join-quad", async (req) => {
        const matchId = joinQuadQueue(req.body.userId);
        if (matchId === -1) return { ok: true, status: "waiting" };
        return { ok: true, status: "matched", matchId };
    });

    fastify.get<{ Querystring: { userId: string } }>("/api/join-quad/status", async (req) => {
        const userId = Number(req.query.userId);
        if (quadStatus[userId]) {
            const matchId = quadStatus[userId];
            delete quadStatus[userId];
            return { ok: true, status: "matched", matchId };
        }
        return { ok: true, status: "waiting" };
    });
}
