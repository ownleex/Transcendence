import "fastify";
import { Database } from "sqlite"; // matches your db export type

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}
