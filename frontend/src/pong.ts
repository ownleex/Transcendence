// pong.ts
import { io, Socket } from "socket.io-client";

export type GameMode = "duo" | "quad";

interface GameState {
    player1Y: number;
    player2Y: number;
    player3X?: number;
    player4X?: number;
    ballX: number;
    ballY: number;
}

// --- Chat socket + état global match ---
let chatSocket: Socket | null = null;
let currentMatchId: number | null = null;

/**
 * Affiche et lance une partie (duo ou quad) + chat de match.
 */
export async function showGame(container: HTMLElement, mode: GameMode = "duo") {
    container.innerHTML = "Looking for match...";

     const storedMe =
        sessionStorage.getItem("me") || localStorage.getItem("me") || "{}";
    const me = JSON.parse(storedMe);
    const currentUserId = me.id;

    if (!currentUserId) {
        alert("User not logged in!");
        return;
    }
    // ---------------------------
    // Join queue
    // ---------------------------
    const joinUrl = mode === "duo" ? "/api/join-duo" : "/api/join-quad";
    const statusUrl = mode === "duo" ? "/api/join-duo/status" : "/api/join-quad/status";

    await fetch(joinUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId })
    });

    // ---------------------------
    // Poll for match
    // ---------------------------
    let matchId: number | null = null;
    while (!matchId) {
        const res = await fetch(`${statusUrl}?userId=${currentUserId}`);
        const data = await res.json();
        if (data.status === "matched") {
            matchId = data.matchId;
        } else {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    currentMatchId = matchId;

    // Nettoyage conteneur pour afficher le jeu + chat
    container.innerHTML = "";

    // ---------------------------
    // Canvas setup
    // ---------------------------
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    canvas.style.border = "1px solid #ccc";
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

    // ---------------------------
    // Chat UI (créé dynamiquement)
    // ---------------------------
    const chatWrapper = document.createElement("div");
    chatWrapper.style.position = "absolute";
    chatWrapper.style.right = "20px";
    chatWrapper.style.bottom = "20px";
    chatWrapper.style.width = "260px";
    chatWrapper.style.maxHeight = "260px";
    chatWrapper.style.background = "rgba(0,0,0,0.05)";
    chatWrapper.style.borderRadius = "8px";
    chatWrapper.style.padding = "8px";
    chatWrapper.style.display = "flex";
    chatWrapper.style.flexDirection = "column";
    chatWrapper.style.fontSize = "12px";
    chatWrapper.style.backdropFilter = "blur(4px)";

    // On met le conteneur principal en relative pour que l'absolute du chat fonctionne bien
    if (getComputedStyle(container).position === "static") {
        container.style.position = "relative";
    }

    const messagesList = document.createElement("ul");
    messagesList.id = "pong-chat-messages";
    messagesList.style.listStyle = "none";
    messagesList.style.margin = "0 0 8px 0";
    messagesList.style.padding = "0";
    messagesList.style.overflowY = "auto";
    messagesList.style.maxHeight = "180px";

    const form = document.createElement("form");
    form.id = "pong-chat-form";
    form.style.display = "flex";
    form.style.gap = "4px";

    const input = document.createElement("input");
    input.id = "pong-chat-input";
    input.type = "text";
    input.placeholder = "Tape ton message...";
    input.autocomplete = "off";
    input.style.flex = "1";

    const btn = document.createElement("button");
    btn.type = "submit";
    btn.textContent = "Envoyer";

    form.appendChild(input);
    form.appendChild(btn);
    chatWrapper.appendChild(messagesList);
    chatWrapper.appendChild(form);
    container.appendChild(chatWrapper);

    // ---------------------------
    // Init chat de match
    // ---------------------------
    initMatchChat(matchId, messagesList);
    setupChatForm(form, input);

    // ---------------------------
    // Constantes jeu
    // ---------------------------
    const PADDLE_LENGTH = 100;
    const PADDLE_SPEED = 5;
    const BALL_RADIUS = 10;

    let state: GameState = {
        player1Y: canvas.height / 2,
        player2Y: canvas.height / 2,
        ballX: canvas.width / 2,
        ballY: canvas.height / 2,
    };

    if (mode === "quad") {
        state.player3X = canvas.width / 2;
        state.player4X = canvas.width / 2;
    }

    // ---------------------------
    // Key handling
    // ---------------------------
    const keys = new Set<string>();
    const keydownHandler = (e: KeyboardEvent) => keys.add(e.key);
    const keyupHandler = (e: KeyboardEvent) => keys.delete(e.key);

    window.addEventListener("keydown", keydownHandler);
    window.addEventListener("keyup", keyupHandler);

    // ---------------------------
    // WebSocket connection (jeu)
    // ---------------------------
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${location.host}/game?matchId=${matchId}&userId=${currentUserId}`);

    let myPaddleIndex: number | null = null;

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: "whoami" }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "identify") {
            myPaddleIndex = msg.index; // 1 to 4
        }

        if (msg.type === "state") {
            const s = msg.state;
            state.ballX = s.ball.x;
            state.ballY = s.ball.y;
            state.player1Y = s.paddles.p1;
            state.player2Y = s.paddles.p2;

            if (mode === "quad") {
                state.player3X = s.paddles.p3;
                state.player4X = s.paddles.p4;
            }
        }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);
    ws.onclose = () => {
        console.log("WebSocket closed");
        window.removeEventListener("keydown", keydownHandler);
        window.removeEventListener("keyup", keyupHandler);
    };

    // ---------------------------
    // Paddle input processing
    // ---------------------------
    function sendPaddle() {
        if (!myPaddleIndex) return;

        if (myPaddleIndex === 1) {
            if (keys.has("w")) ws.send(JSON.stringify({ type: "paddle", axis: "y", value: state.player1Y - PADDLE_SPEED }));
            if (keys.has("s")) ws.send(JSON.stringify({ type: "paddle", axis: "y", value: state.player1Y + PADDLE_SPEED }));
        }

        if (myPaddleIndex === 2) {
            if (keys.has("ArrowUp")) ws.send(JSON.stringify({ type: "paddle", axis: "y", value: state.player2Y - PADDLE_SPEED }));
            if (keys.has("ArrowDown")) ws.send(JSON.stringify({ type: "paddle", axis: "y", value: state.player2Y + PADDLE_SPEED }));
        }

        if (myPaddleIndex === 3 && mode === "quad") {
            if (keys.has("a")) ws.send(JSON.stringify({ type: "paddle", axis: "x", value: (state.player3X ?? 0) - PADDLE_SPEED }));
            if (keys.has("d")) ws.send(JSON.stringify({ type: "paddle", axis: "x", value: (state.player3X ?? 0) + PADDLE_SPEED }));
        }

        if (myPaddleIndex === 4 && mode === "quad") {
            if (keys.has("j")) ws.send(JSON.stringify({ type: "paddle", axis: "x", value: (state.player4X ?? 0) - PADDLE_SPEED }));
            if (keys.has("l")) ws.send(JSON.stringify({ type: "paddle", axis: "x", value: (state.player4X ?? 0) + PADDLE_SPEED }));
        }
    }

    const paddleInterval = setInterval(sendPaddle, 1000 / 60);

    // ---------------------------
    // Draw loop
    // ---------------------------
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Ball
        ctx.beginPath();
        ctx.arc(state.ballX, state.ballY, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "black";
        ctx.fill();

        // Player 1 paddle
        ctx.fillRect(20, state.player1Y - PADDLE_LENGTH / 2, 10, PADDLE_LENGTH);

        // Player 2 paddle
        ctx.fillRect(canvas.width - 30, state.player2Y - PADDLE_LENGTH / 2, 10, PADDLE_LENGTH);

        if (mode === "quad") {
            // Player 3 top horizontal
            ctx.fillRect((state.player3X ?? 0) - PADDLE_LENGTH / 2, 20, PADDLE_LENGTH, 10);

            // Player 4 bottom horizontal
            ctx.fillRect((state.player4X ?? 0) - PADDLE_LENGTH / 2, canvas.height - 30, PADDLE_LENGTH, 10);
        }

        requestAnimationFrame(draw);
    }

    draw();

    // Petite sécurité si jamais tu quittes la page / détruis le container
    const observer = new MutationObserver(() => {
        if (!document.body.contains(container)) {
            clearInterval(paddleInterval);
            ws.close();
            if (chatSocket) {
                chatSocket.disconnect();
                chatSocket = null;
            }
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Initialise la connexion Socket.io pour le chat du match
 */
function initMatchChat(matchId: number, messagesList: HTMLUListElement) {
    // On évite les doublons
    if (chatSocket) {
        chatSocket.disconnect();
        chatSocket = null;
    }

    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    if (!token) {
        console.warn("No token for chat socket");
        return;
    }

    chatSocket = io(window.location.origin, {
        transports: ["websocket"],
        auth: { token },
    });

    chatSocket.emit("joinMatchChat", matchId);

    chatSocket.on("chat:message", (msg: { from: number; text: string; at: string }) => {
        const li = document.createElement("li");
        const time = new Date(msg.at).toLocaleTimeString();
        li.textContent = `[${time}] #${msg.from}: ${msg.text}`;
        messagesList.appendChild(li);
        messagesList.scrollTop = messagesList.scrollHeight;
    });
}

/**
 * Gère l'envoi de messages depuis le formulaire de chat
 */
function setupChatForm(form: HTMLFormElement, input: HTMLInputElement) {
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || !chatSocket || currentMatchId == null) return;

        chatSocket.emit("chat:message", {
            matchId: currentMatchId,
            text,
        });

        input.value = "";
    });
}
