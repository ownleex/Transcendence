// backend/src/plugins/db.ts
import fp from "fastify-plugin";
import { initDB } from "../db";

export default fp(async (fastify) => {
  const db = await initDB();
  fastify.decorate("db", db);

  fastify.addHook("onClose", async (fastifyInstance) => {
    await db.close();
  });
});
