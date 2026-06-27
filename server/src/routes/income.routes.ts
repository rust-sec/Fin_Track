import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser, requireAuth, requireFamilyMember } from "../auth.js";
import { prisma } from "../prisma.js";
import { parseMonth } from "../utils/dates.js";

const familyParams = z.object({ familyId: z.string() });
const incomeParams = z.object({ familyId: z.string(), incomeSourceId: z.string() });

const incomeSourceSchema = z.object({
  name: z.string().min(1),
  monthlyAmount: z.number().positive(),
  currency: z.string().min(3).max(3).default("INR"),
  startMonth: z.string(),
  endMonth: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

export async function incomeRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/families/:familyId/income-sources", async (request, reply) => {
    const user = getAuthUser(request);
    const params = familyParams.parse(request.params);
    if (!(await requireFamilyMember(user.id, params.familyId))) {
      return reply.code(403).send({ message: "No access to this family" });
    }
    return prisma.incomeSource.findMany({
      where: { familyId: params.familyId },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post("/families/:familyId/income-sources", async (request, reply) => {
    const user = getAuthUser(request);
    const params = familyParams.parse(request.params);
    const input = incomeSourceSchema.parse(request.body);
    if (!(await requireFamilyMember(user.id, params.familyId))) {
      return reply.code(403).send({ message: "No access to this family" });
    }
    const source = await prisma.incomeSource.create({
      data: {
        familyId: params.familyId,
        name: input.name,
        monthlyAmount: input.monthlyAmount,
        currency: input.currency.toUpperCase(),
        startMonth: parseMonth(input.startMonth),
        endMonth: input.endMonth ? parseMonth(input.endMonth) : null,
        isActive: input.isActive,
        notes: input.notes,
      },
    });
    return reply.code(201).send(source);
  });

  app.put("/families/:familyId/income-sources/:incomeSourceId", async (request, reply) => {
    const user = getAuthUser(request);
    const params = incomeParams.parse(request.params);
    const input = incomeSourceSchema.parse(request.body);
    if (!(await requireFamilyMember(user.id, params.familyId))) {
      return reply.code(403).send({ message: "No access to this family" });
    }
    const source = await prisma.incomeSource.updateMany({
      where: { id: params.incomeSourceId, familyId: params.familyId },
      data: {
        name: input.name,
        monthlyAmount: input.monthlyAmount,
        currency: input.currency.toUpperCase(),
        startMonth: parseMonth(input.startMonth),
        endMonth: input.endMonth ? parseMonth(input.endMonth) : null,
        isActive: input.isActive,
        notes: input.notes,
      },
    });
    return source.count ? { ok: true } : reply.code(404).send({ message: "Income source not found" });
  });

  app.delete("/families/:familyId/income-sources/:incomeSourceId", async (request, reply) => {
    const user = getAuthUser(request);
    const params = incomeParams.parse(request.params);
    if (!(await requireFamilyMember(user.id, params.familyId))) {
      return reply.code(403).send({ message: "No access to this family" });
    }
    await prisma.incomeSource.deleteMany({
      where: { id: params.incomeSourceId, familyId: params.familyId },
    });
    return { ok: true };
  });
}
