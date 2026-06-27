import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify from "fastify";
import { ZodError } from "zod";
import { authRoutes } from "./routes/auth.routes.js";
import { budgetRoutes } from "./routes/budget.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";
import { familyRoutes } from "./routes/family.routes.js";
import { incomeRoutes } from "./routes/income.routes.js";
import { positionRoutes } from "./routes/position.routes.js";
import { transactionRoutes } from "./routes/transaction.routes.js";
import { config } from "./config.js";
import { prisma } from "./prisma.js";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: config.corsOrigin,
  credentials: true,
});

await app.register(cookie, {
  secret: config.cookieSecret,
});

await app.register(jwt, {
  secret: config.jwtSecret,
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      message: "Invalid request",
      issues: error.issues,
    });
  }

  app.log.error(error);
  return reply.code(500).send({ message: "Internal server error" });
});

app.get("/health", async () => ({ ok: true }));

await app.register(authRoutes, { prefix: "/api" });
await app.register(familyRoutes, { prefix: "/api" });
await app.register(transactionRoutes, { prefix: "/api" });
await app.register(incomeRoutes, { prefix: "/api" });
await app.register(budgetRoutes, { prefix: "/api" });
await app.register(positionRoutes, { prefix: "/api" });
await app.register(dashboardRoutes, { prefix: "/api" });

const close = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", close);
process.on("SIGTERM", close);

await app.listen({ host: "0.0.0.0", port: config.port });
