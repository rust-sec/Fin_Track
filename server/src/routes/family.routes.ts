import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser, requireAuth, requireFamilyMember } from "../auth.js";
import { prisma } from "../prisma.js";

const createFamilySchema = z.object({
  name: z.string().min(1),
  baseCurrency: z.string().min(3).max(3).default("INR"),
});

export async function familyRoutes(app: FastifyInstance) {
  app.get("/families", { preHandler: requireAuth }, async (request) => {
    const user = getAuthUser(request);
    return prisma.familyMembership.findMany({
      where: { userId: user.id },
      include: { family: true },
      orderBy: { createdAt: "asc" },
    });
  });

  app.post("/families", { preHandler: requireAuth }, async (request, reply) => {
    const user = getAuthUser(request);
    const input = createFamilySchema.parse(request.body);
    const family = await prisma.family.create({
      data: {
        name: input.name,
        baseCurrency: input.baseCurrency.toUpperCase(),
        memberships: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });
    return reply.code(201).send(family);
  });

  app.get("/families/:familyId", { preHandler: requireAuth }, async (request, reply) => {
    const user = getAuthUser(request);
    const params = z.object({ familyId: z.string() }).parse(request.params);
    const membership = await requireFamilyMember(user.id, params.familyId);
    if (!membership) return reply.code(403).send({ message: "No access to this family" });
    return prisma.family.findUniqueOrThrow({ where: { id: params.familyId } });
  });
}
