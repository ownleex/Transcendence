// pong.ts
export type GameMode = "duo" | "quad";

interface GameState {
    player1Y: number;
    player2Y: number;
    player3X?: number;
    player4X?: number;
    ballX: number;
    ballY: number;
}

export async function showGame(container: HTMLElement, mode: GameMode = "duo") {
    container.innerHTML = "Looking for match...";

    const me = JSON.parse(localStorage.getItem("me") || "{}");
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

    container.innerHTML = "";

    // ---------------------------
    // Canvas setup
    // ---------------------------
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

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
    window.addEventListener("keydown", e => keys.add(e.key));
    window.addEventListener("keyup", e => keys.delete(e.key));

    // ---------------------------
    // WebSocket connection
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
    ws.onclose = () => console.log("WebSocket closed");

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

    setInterval(sendPaddle, 1000 / 60);

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
}