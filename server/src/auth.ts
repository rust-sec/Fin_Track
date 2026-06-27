import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./prisma.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ message: "Authentication required" });
  }
}

export function getAuthUser(request: FastifyRequest): AuthUser {
  return request.user as AuthUser;
}

export async function requireFamilyMember(userId: string, familyId: string) {
  const membership = await prisma.familyMembership.findUnique({
    where: {
      familyId_userId: {
        familyId,
        userId,
      },
    },
  });

  return membership;
}
