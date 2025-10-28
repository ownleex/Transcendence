import WebSocket, { WebSocketServer } from "ws";
import http from "http";

interface GameState {
  player1Y: number;
  player2Y: number;
  ballX: number;
  ballY: number;
}

export function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server });
  let state: GameState = { player1Y: 100, player2Y: 100, ballX: 250, ballY: 150 };

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify(state));

    ws.on("message", (msg) => {
      const data = JSON.parse(msg.toString());
      state = { ...state, ...data };
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(state));
      });
    });
  });
}
