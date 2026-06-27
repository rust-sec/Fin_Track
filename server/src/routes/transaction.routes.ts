import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser, requireAuth, requireFamilyMember } from "../auth.js";
import { prisma } from "../prisma.js";
import { parseDate } from "../utils/dates.js";

const familyParams = z.object({ familyId: z.string() });

const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  date: z.string(),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3).default("INR"),
  category: z.string().min(1),
  description: z.string().min(1),
  accountName: z.string().optional(),
  notes: z.string().optional(),
});

export async function transactionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/families/:familyId/transactions", async (request, reply) => {
    const user = getAuthUser(request);
    const params = familyParams.parse(request.params);
    const query = z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      type: z.enum(["INCOME", "EXPENSE"]).optional(),
    }).parse(request.query);

    if (!(await requireFamilyMember(user.id, params.familyId))) {
      return reply.code(403).send({ message: "No access to this family" });
    }

    return prisma.transaction.findMany({
      where: {
        familyId: params.familyId,
        type: query.type,
        date: {
          gte: query.from ? parseDate(query.from) : undefined,
          lt: query.to ? parseDate(query.to) : undefined,
        },
      },
      orderBy: { date: "desc" },
    });
  });

  app.post("/families/:familyId/transactions", async (request, reply) => {
    const user = getAuthUser(request);
    const params = familyParams.parse(request.params);
    const input = transactionSchema.parse(request.body);

    if (!(await requireFamilyMember(user.id, params.familyId))) {
      return reply.code(403).send({ message: "No access to this family" });
    }

    const transaction = await prisma.transaction.create({
      data: {
        familyId: params.familyId,
        createdByUserId: user.id,
        type: input.type,
        date: parseDate(input.date),
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        category: input.category,
        description: input.description,
        accountName: input.accountName,
        notes: input.notes,
      },
    });

    return reply.code(201).send(transaction);
  });
}
