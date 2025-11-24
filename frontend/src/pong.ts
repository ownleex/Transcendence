/*
import { GameState } from "./types";

export function showGame(container: HTMLElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 500;
  canvas.height = 300;
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d")!;
  const state: GameState = { player1Y: 100, player2Y: 100, ballX: 250, ballY: 150 };

  function draw() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.fillRect(10, state.player1Y, 10, 50);
    ctx.fillRect(canvas.width - 20, state.player2Y, 10, 50);
    ctx.fillRect(state.ballX, state.ballY, 10, 10);

    requestAnimationFrame(draw);
  }

  draw();
}

// main.ts
import { GameState } from "./types";

export function showGame(container: HTMLElement) {
  'use strict';
  // ----- Canvas -----
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  // Apply the CSS from <style>
  canvas.style.display = 'block';
  canvas.style.background = '#fff';
  container.style.margin = '0';
  container.style.padding = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';

  // ----- HiDPI -----
  let width = 0, height = 0, ratio = window.devicePixelRatio || 1;

  function resize() {
    width  = container.clientWidth;
    height = container.clientHeight;
    ratio  = window.devicePixelRatio || 1;

    canvas.width  = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width  = width + 'px';
    canvas.style.height = height + 'px';

    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(ratio, ratio);

    resetRound(true); // reset positions
  }
  window.addEventListener('resize', resize);

  // ----- Constants -----
  const PADDLE_W = 14;
  const PADDLE_H = 100;
  const PADDLE_SPEED = 420;
  const BALL_SPEED   = 520;
  const BALL_R       = 10;

  // ----- State -----
  const keys = new Set<string>();

  const player1 = { x: 40, y: 0, w: PADDLE_W, h: PADDLE_H, score: 0 };
  const player2 = { x: 0,  y: 0, w: PADDLE_W, h: PADDLE_H, score: 0 };

  const ball = {
    x: 0, y: 0, r: BALL_R,
    vx: 0, vy: 0, speed: BALL_SPEED,
    serveDir: 1
  };

  function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

  // ----- Input -----
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp','ArrowDown','w','W','s','S'].includes(e.key)) e.preventDefault();
    keys.add(e.key);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key));

  // ----- Reset / New round -----
  function resetRound(centerOnly = false) {
    player1.y = height / 2;
    player2.x = width - 40;
    player2.y = height / 2;

    ball.x = width / 2;
    ball.y = height / 2;

    if (centerOnly) return;

    const angle = (Math.random() * 0.5 - 0.25); // [-14°, +14°]
    ball.vx = Math.cos(angle) * ball.speed * ball.serveDir;
    ball.vy = Math.sin(angle) * ball.speed;
  }

  // ----- Collision -----
  function circleRectCollide(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number) {
    const left = rx - rw/2, right = rx + rw/2;
    const top  = ry - rh/2, bottom = ry + rh/2;
    const closestX = clamp(cx, left, right);
    const closestY = clamp(cy, top, bottom);
    const dx = cx - closestX, dy = cy - closestY;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  function bounceOnPaddle(paddle: typeof player1) {
    const rel = clamp((ball.y - paddle.y) / (paddle.h / 2), -1, 1);
    const maxAngle = Math.PI / 4;
    const angle = rel * maxAngle;
    const dir = (paddle === player1) ? 1 : -1;

    ball.vx = Math.cos(angle) * ball.speed * dir;
    ball.vy = Math.sin(angle) * ball.speed;

    if (dir > 0) ball.x = paddle.x + paddle.w/2 + ball.r + 0.5;
    else         ball.x = paddle.x - paddle.w/2 - ball.r - 0.5;
  }

  // ----- Update loop -----
  let last = performance.now();
  function step(now: number) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    // Paddle movement
    let dy1 = 0, dy2 = 0;
    if (keys.has('w') || keys.has('W')) dy1 -= 1;
    if (keys.has('s') || keys.has('S')) dy1 += 1;
    if (keys.has('ArrowUp'))    dy2 -= 1;
    if (keys.has('ArrowDown'))  dy2 += 1;

    player1.y += dy1 * PADDLE_SPEED * dt;
    player2.y += dy2 * PADDLE_SPEED * dt;

    player1.y = clamp(player1.y, PADDLE_H/2, height - PADDLE_H/2);
    player2.y = clamp(player2.y, PADDLE_H/2, height - PADDLE_H/2);

    // Move ball
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Bounce top/bottom
    if (ball.y - ball.r < 0) {
      ball.y = ball.r; ball.vy *= -1;
    } else if (ball.y + ball.r > height) {
      ball.y = height - ball.r; ball.vy *= -1;
    }

    // Paddle collision
    if (circleRectCollide(ball.x, ball.y, ball.r, player1.x, player1.y, player1.w, player1.h)) bounceOnPaddle(player1);
    if (circleRectCollide(ball.x, ball.y, ball.r, player2.x, player2.y, player2.w, player2.h)) bounceOnPaddle(player2);

    // Score
    if (ball.x + ball.r < 0) {
      player2.score++; ball.serveDir = -1; resetRound(false);
    } else if (ball.x - ball.r > width) {
      player1.score++; ball.serveDir = 1; resetRound(false);
    }

    draw();
    requestAnimationFrame(step);
  }

  // ----- Draw -----
  function draw() {
    ctx.clearRect(0,0,width,height);

    // Center line
    ctx.beginPath();
    ctx.setLineDash([8,16]);
    ctx.moveTo(width/2,0);
    ctx.lineTo(width/2,height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // Ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // Paddles
    ctx.fillRect(player1.x - player1.w/2, player1.y - player1.h/2, player1.w, player1.h);
    ctx.fillRect(player2.x - player2.w/2, player2.y - player2.h/2, player2.w, player2.h);

    // Score
    ctx.font = '20px Arial';
    ctx.fillText(`P1: ${player1.score}`, 24, 28);
    ctx.fillText(`P2: ${player2.score}`, width - 100, 28);
  }

  // ----- Start -----
  resize();
  resetRound(false);
  requestAnimationFrame(step);
}
*/
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
        body: JSON.stringify({ userId: currentUserId }),
    });

    // ---------------------------
    // Poll for match (recursive)
    // ---------------------------
    async function waitForMatch(): Promise<number> {
        const res = await fetch(`${statusUrl}?userId=${currentUserId}`);
        const data = await res.json();
        if (data.status === "matched") return data.matchId;
        await new Promise(r => setTimeout(r, 1000));
        return waitForMatch();
    }

    const matchId = await waitForMatch();
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

    ws.onopen = () => ws.send(JSON.stringify({ type: "whoami" }));

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

        switch (myPaddleIndex) {
            case 1:
                if (keys.has("w")) state.player1Y -= PADDLE_SPEED;
                if (keys.has("s")) state.player1Y += PADDLE_SPEED;
                ws.send(JSON.stringify({ type: "paddle", axis: "y", value: state.player1Y }));
                break;
            case 2:
                if (keys.has("ArrowUp")) state.player2Y -= PADDLE_SPEED;
                if (keys.has("ArrowDown")) state.player2Y += PADDLE_SPEED;
                ws.send(JSON.stringify({ type: "paddle", axis: "y", value: state.player2Y }));
                break;
            case 3:
                if (mode === "quad") {
                    if (keys.has("a")) state.player3X = (state.player3X ?? 0) - PADDLE_SPEED;
                    if (keys.has("d")) state.player3X = (state.player3X ?? 0) + PADDLE_SPEED;
                    ws.send(JSON.stringify({ type: "paddle", axis: "x", value: state.player3X }));
                }
                break;
            case 4:
                if (mode === "quad") {
                    if (keys.has("j")) state.player4X = (state.player4X ?? 0) - PADDLE_SPEED;
                    if (keys.has("l")) state.player4X = (state.player4X ?? 0) + PADDLE_SPEED;
                    ws.send(JSON.stringify({ type: "paddle", axis: "x", value: state.player4X }));
                }
                break;
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

