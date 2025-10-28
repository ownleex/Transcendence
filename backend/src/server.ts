import path from "path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";

import dbPlugin from "./plugins/db";
import userRoutes from "./routes/user";
import tournamentRoutes from "./routes/tournament";
import statsRoutes from "./routes/stats";
import notificationRoutes from "./routes/notification";
import { setupWebSocket } from "./ws/game";

const fastify = Fastify({ logger: true });

// Register plugins
fastify.register(fastifyCors, { origin: "*" });
fastify.register(dbPlugin);

// -------------------------
// API Routes
// -------------------------

fastify.register(userRoutes, { prefix: "/api/users" });
fastify.register(tournamentRoutes, { prefix: "/api/tournament" });
fastify.register(statsRoutes, { prefix: "/api/stats" });
fastify.register(notificationRoutes, { prefix: "/api/notifications" });

// List all database tables
fastify.get("/api/tables", async (request, reply) => {
  const db = fastify.db;
  const rows = await db.all(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `);
  return rows.map(r => r.name);
});

// View first 10 rows of a table
fastify.get<{ Params: { name: string } }>("/api/table/:name", async (request, reply) => {
  const db = fastify.db;
  const table = request.params.name;

  // Basic validation to prevent SQL injection
  if (!/^[A-Za-z0-9_]+$/.test(table)) {
    reply.code(400).send({ error: "Invalid table name" });
    return;
  }

  try {
    const rows = await db.all(`SELECT * FROM "${table}" LIMIT 10`);
    return rows;
  } catch (err: any) {
    reply.code(500).send({ error: err.message });
  }
});

// -------------------------
// Static files & SPA fallback
// -------------------------

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "../../frontend"),
  prefix: "/",
});

// SPA fallback for all other routes
fastify.setNotFoundHandler((req, reply) => {
  reply.sendFile("index.html");
});

// -------------------------
// Start server
// -------------------------

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    setupWebSocket(fastify.server);
    console.log("🚀 Transcendence running at http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
