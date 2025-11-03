import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyOauth2, { OAuth2Namespace } from "@fastify/oauth2";
import fetch from "node-fetch";

const FORTYTWO_CONFIGURATION = {
  authorizeHost: "https://api.intra.42.fr",
  authorizePath: "/oauth/authorize",
  tokenHost: "https://api.intra.42.fr",
  tokenPath: "/oauth/token",
};

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.register(fastifyOauth2, {
    name: "fortyTwoOAuth2",
    scope: ["public"],
    credentials: {
      client: {
        id: process.env.FORTYTWO_CLIENT_ID!,
        secret: process.env.FORTYTWO_CLIENT_SECRET!,
      },
      auth: FORTYTWO_CONFIGURATION,
    },
    startRedirectPath: "/api/auth/signin",
    callbackUri: "https://localhost:3000/api/auth/callback/42",
  });

  fastify.get("/api/auth/callback/42", async (req: FastifyRequest, reply: FastifyReply) => {
    const token = await (fastify as FastifyInstance & { fortyTwoOAuth2: OAuth2Namespace })
      .fortyTwoOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);

    const userData = await fetch("https://api.intra.42.fr/v2/me", {
      headers: { Authorization: `Bearer ${token.token.access_token}` },
    }).then((res: Response) => res.json() as any);

    type DBUser = { id: number; username: string; email: string };
    let user = (await fastify.db.get("SELECT * FROM User WHERE email = ?", [userData.email])) as DBUser | undefined;

    if (!user) {
      const result = (await fastify.db.run(
        "INSERT INTO User (username, email, password) VALUES (?, ?, ?)",
        [userData.login, userData.email, ""]
      )) as { lastID: number; changes: number };

      user = { id: result.lastID, username: userData.login, email: userData.email };
    }

    const jwt = fastify.jwt.sign({ id: user.id, username: user.username });
    reply.redirect(`/frontend/index.html?token=${jwt}`);
  });
}

