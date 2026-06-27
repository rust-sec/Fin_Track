import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser, requireAuth, requireFamilyMember } from "../auth.js";
import { prisma } from "../prisma.js";
import { parseMonth } from "../utils/dates.js";

const familyParams = z.object({ familyId: z.string() });

const budgetSchema = z.object({
  month: z.string(),
  category: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().min(3).max(3).default("INR"),
});

export async function budgetRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/families/:familyId/budgets", async (request, reply) => {
    const user = getAuthUser(request);
    const params = familyParams.parse(request.params);
    const query = z.object({ month: z.string().optional() }).parse(request.query);
    if (!(await requireFamilyMember(user.id, params.familyId))) {
      return reply.code(403).send({ message: "No access to this family" });
    }
    return prisma.budget.findMany({
      where: {
        familyId: params.familyId,
        month: query.month ? parseMonth(query.month) : undefined,
      },
      orderBy: [{ month: "desc" }, { category: "asc" }],
    });
  });

  app.put("/families/:familyId/budgets", async (request, reply) => {
    const user = getAuthUser(request);
    const params = familyParams.parse(request.params);
    const input = budgetSchema.parse(request.body);
    if (!(await requireFamilyMember(user.id, params.familyId))) {
      return reply.code(403).send({ message: "No access to this family" });
    }
    const budget = await prisma.budget.upsert({
      where: {
        familyId_month_category: {
          familyId: params.familyId,
          month: parseMonth(input.month),
          category: input.category,
        },
      },
      update: {
        amount: input.amount,
        currency: input.currency.toUpperCase(),
      },
      create: {
        familyId: params.familyId,
        month: parseMonth(input.month),
        category: input.category,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
      },
    });
    return reply.code(200).send(budget);
  });
}
