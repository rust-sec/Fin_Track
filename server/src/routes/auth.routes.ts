import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser, requireAuth } from "../auth.js";
import { config } from "../config.js";
import { prisma } from "../prisma.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  familyName: z.string().min(1).default("My Family"),
  baseCurrency: z.string().min(3).max(3).default("INR"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        memberships: {
          create: {
            role: "OWNER",
            family: {
              create: {
                name: input.familyName,
                baseCurrency: input.baseCurrency.toUpperCase(),
              },
            },
          },
        },
      },
      include: { memberships: true },
    });

    const tokenPayload = { id: user.id, email: user.email, name: user.name };
    const accessToken = app.jwt.sign(tokenPayload, { expiresIn: "15m" });
    const refreshToken = app.jwt.sign(tokenPayload, { expiresIn: "30d" });

    reply.setCookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: "lax",
      path: "/api/auth",
    });

    return reply.code(201).send({
      accessToken,
      user: tokenPayload,
      familyId: user.memberships[0]?.familyId,
    });
  });

  app.post("/auth/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { memberships: true },
    });

    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      return reply.code(401).send({ message: "Invalid email or password" });
    }

    const tokenPayload = { id: user.id, email: user.email, name: user.name };
    const accessToken = app.jwt.sign(tokenPayload, { expiresIn: "15m" });
    const refreshToken = app.jwt.sign(tokenPayload, { expiresIn: "30d" });

    reply.setCookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: "lax",
      path: "/api/auth",
    });

    return {
      accessToken,
      user: tokenPayload,
      familyId: user.memberships[0]?.familyId,
    };
  });

  app.post("/auth/refresh", async (request, reply) => {
    const token = request.cookies.refresh_token;
    if (!token) return reply.code(401).send({ message: "Refresh token missing" });

    try {
      const user = app.jwt.verify(token) as { id: string; email: string; name: string };
      return { accessToken: app.jwt.sign(user, { expiresIn: "15m" }) };
    } catch {
      return reply.code(401).send({ message: "Invalid refresh token" });
    }
  });

  app.post("/auth/logout", async (_request, reply) => {
    reply.clearCookie("refresh_token", { path: "/api/auth" });
    return { ok: true };
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (request) => {
    const user = getAuthUser(request);
    const memberships = await prisma.familyMembership.findMany({
      where: { userId: user.id },
      include: { family: true },
      orderBy: { createdAt: "asc" },
    });
    return { user, memberships };
  });
}
