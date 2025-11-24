import { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { WebSocket } from "ws";

// --------------------
// Game matches only
// --------------------
interface GameQuery { matchId?: string; userId: string; }

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
    sockets: Map<number, WebSocket>;
    state: GameState;
}

// --------------------
// State
// --------------------
const matches = new Map<number, Match>();
let duoQueue: number[] = [];
let quadQueue: number[] = [];
let duoStatus: Record<number, number> = {};
let quadStatus: Record<number, number> = {};

// --------------------
// Create Match
// --------------------
function createMatch(matchId: number, mode: 2 | 4, players: number[]) {
    const baseBall = { x: 400, y: 300, vx: 300, vy: 200 };
    const state: GameState = mode === 2
        ? { mode: 2, paddles: { p1: 300, p2: 300 }, ball: { ...baseBall } }
        : { mode: 4, paddles: { p1: 300, p2: 300, p3: 300, p4: 300 }, ball: { ...baseBall } };
    const match: Match = { matchId, mode, players, sockets: new Map(), state };
    matches.set(matchId, match);
    return match;
}

// --------------------
// Matchmaking
// --------------------
function joinDuoQueue(userId: number): number {
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

function joinQuadQueue(userId: number): number {
    quadQueue.push(userId);
    if (quadQueue.length >= 4) {
        const players = quadQueue.splice(0, 4);
        const matchId = Date.now();
        createMatch(matchId, 4, players);
        players.forEach(id => { quadStatus[id] = matchId; });
        return matchId;
    }
    return -1;
}

// --------------------
// WebSocket Setup (game only)
// --------------------
export function setupGameWS(fastify: FastifyInstance) {
    fastify.register(websocket);

    fastify.get<{ Querystring: GameQuery }>(
        "/game",
        { websocket: true },
        (conn, req) => {
            const socket: WebSocket = (conn as any).socket;
            const userId = Number(req.query.userId);
            const matchId = req.query.matchId ? Number(req.query.matchId) : undefined;

            // Join match if matchId provided
            let match: Match | undefined;
            if (matchId && matches.has(matchId)) {
                match = matches.get(matchId);
                match!.sockets.set(userId, socket);
                socket.send(JSON.stringify({ type: "state", state: match!.state }));
                console.log(`User ${userId} joined match ${matchId}`);
            }

            socket.on("message", (raw: any) => {
                const data = JSON.parse(raw.toString());

                // Identify player in match
                if (data.type === "whoami" && match) {
                    const index = match.players.indexOf(userId) + 1;
                    socket.send(JSON.stringify({ type: "identify", index }));
                    return;
                }

                // Paddle move for match
                if (data.type === "paddle" && match?.players.includes(userId)) {
                    const index = match.players.indexOf(userId) + 1;
                    if (match.state.mode === 2) {
                        (match.state.paddles as any)[`p${index}`] = data.value;
                    } else {
                        if (index <= 2 && data.axis === "y") (match.state.paddles as any)[`p${index}`] = data.value;
                        if (index >= 3 && data.axis === "x") (match.state.paddles as any)[`p${index}`] = data.value;
                    }
                }
            });

            socket.on("close", () => {
                if (match) match.sockets.delete(userId);
            });
        }
    );

    // Physics loop for matches
    setInterval(() => {
        for (const match of matches.values()) {
            const b = match.state.ball;
            b.x += b.vx * 0.016;
            b.y += b.vy * 0.016;
            if (b.y < 0 || b.y > 600) b.vy *= -1;
            if (b.x < 0 || b.x > 800) b.vx *= -1;

            const msg = JSON.stringify({ type: "state", state: match.state });
            for (const socket of match.sockets.values()) {
                if (socket.readyState === WebSocket.OPEN) socket.send(msg);
            }
        }
    }, 16);

    // ---------------------------
    // API endpoints
    // ---------------------------
    fastify.post<{ Body: { userId: number } }>("/api/join-duo", async (req) => {
        const matchId = joinDuoQueue(req.body.userId);
        return matchId === -1
            ? { ok: true, status: "waiting" }
            : { ok: true, status: "matched", matchId };
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
        return matchId === -1
            ? { ok: true, status: "waiting" }
            : { ok: true, status: "matched", matchId };
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
