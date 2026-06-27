import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser, requireAuth, requireFamilyMember } from "../auth.js";
import { prisma } from "../prisma.js";
import { parseDate } from "../utils/dates.js";

const familyParams = z.object({ familyId: z.string() });
const positionParams = z.object({ familyId: z.string(), positionId: z.string() });

const positionSchema = z.object({
  kind: z.enum(["ASSET", "LIABILITY"]),
  category: z.string().min(1),
  name: z.string().min(1),
  institution: z.string().optional(),
  owner: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().min(3).max(3).default("INR"),
  currentValue: z.number().nonnegative().optional(),
  valuationDate: z.string().optional(),
});

const valuationSchema = z.object({
  valuationDate: z.string(),
  value: z.number().nonnegative(),
  note: z.string().optional(),
});

export async function positionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/families/:familyId/positions", async (request, reply) => {
    const user = getAuthUser(request);
    const params = familyParams.parse(request.params);
    if (!(await requireFamilyMember(user.id, params.familyId))) {
      return reply.code(403).send({ message: "No access to this family" });
    }
    return prisma.financialPosition.findMany({
      where: { familyId: params.familyId },
      include: { valuations: { orderBy: { valuationDate: "desc" }, take: 10 } },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
  });

  app.post("/families/:familyId/positions", async (request, reply) => {
    const user = getAuthUser(request);
    const params = familyParams.parse(request.params);
    const input = positionSchema.parse(request.body);
    if (!(await requireFamilyMember(user.id, params.familyId))) {
      return reply.code(403).send({ message: "No access to this family" });
    }
    const position = await prisma.financialPosition.create({
      data: {
        familyId: params.familyId,
        kind: input.kind,
        category: input.category,
        name: input.name,
        institution: input.institution,
        owner: input.owner,
        notes: input.notes,
        currency: input.currency.toUpperCase(),
        valuations: input.currentValue === undefined ? undefined : {
          create: {
            valuationDate: parseDate(input.valuationDate ?? new Date().toISOString()),
            value: input.currentValue,
            createdByUserId: user.id,
          },
        },
      },
      include: { valuations: { orderBy: { valuationDate: "desc" } } },
    });
    return reply.code(201).send(position);
  });

  app.post("/families/:familyId/positions/:positionId/valuations", async (request, reply) => {
    const user = getAuthUser(request);
    const params = positionParams.parse(request.params);
    const input = valuationSchema.parse(request.body);
    if (!(await requireFamilyMember(user.id, params.familyId))) {
      return reply.code(403).send({ message: "No access to this family" });
    }
    const position = await prisma.financialPosition.findFirst({
      where: { id: params.positionId, familyId: params.familyId },
    });
    if (!position) return reply.code(404).send({ message: "Position not found" });

    const valuation = await prisma.positionValuation.create({
      data: {
        positionId: params.positionId,
        createdByUserId: user.id,
        valuationDate: parseDate(input.valuationDate),
        value: input.value,
        note: input.note,
      },
    });
    return reply.code(201).send(valuation);
  });
}
