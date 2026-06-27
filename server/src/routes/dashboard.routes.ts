import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthUser, requireAuth, requireFamilyMember } from "../auth.js";
import { prisma } from "../prisma.js";
import { monthRange, parseMonth } from "../utils/dates.js";
import { toNumber } from "../utils/money.js";

const familyParams = z.object({ familyId: z.string() });

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/families/:familyId/dashboard", async (request, reply) => {
    const user = getAuthUser(request);
    const params = familyParams.parse(request.params);
    const query = z.object({ month: z.string() }).parse(request.query);
    if (!(await requireFamilyMember(user.id, params.familyId))) {
      return reply.code(403).send({ message: "No access to this family" });
    }

    const { start, end } = monthRange(query.month);
    const monthStart = parseMonth(query.month);

    const [transactions, incomeSources, budgets, positions] = await Promise.all([
      prisma.transaction.findMany({
        where: { familyId: params.familyId, date: { gte: start, lt: end } },
      }),
      prisma.incomeSource.findMany({
        where: {
          familyId: params.familyId,
          isActive: true,
          startMonth: { lte: monthStart },
          OR: [{ endMonth: null }, { endMonth: { gte: monthStart } }],
        },
      }),
      prisma.budget.findMany({
        where: { familyId: params.familyId, month: monthStart },
      }),
      prisma.financialPosition.findMany({
        where: { familyId: params.familyId, isActive: true },
        include: { valuations: { orderBy: { valuationDate: "desc" }, take: 1 } },
      }),
    ]);

    const oneOffIncome = transactions
      .filter((transaction) => transaction.type === "INCOME")
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const recurringIncome = incomeSources.reduce(
      (sum, source) => sum + toNumber(source.monthlyAmount),
      0,
    );
    const expenses = transactions
      .filter((transaction) => transaction.type === "EXPENSE")
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const budgetTotal = budgets.reduce((sum, budget) => sum + toNumber(budget.amount), 0);

    const assets = positions
      .filter((position) => position.kind === "ASSET")
      .reduce((sum, position) => sum + toNumber(position.valuations[0]?.value), 0);
    const liabilities = positions
      .filter((position) => position.kind === "LIABILITY")
      .reduce((sum, position) => sum + toNumber(position.valuations[0]?.value), 0);

    return {
      month: query.month,
      income: recurringIncome + oneOffIncome,
      recurringIncome,
      oneOffIncome,
      expenses,
      balance: recurringIncome + oneOffIncome - expenses,
      budgetTotal,
      budgetRemaining: budgetTotal - expenses,
      assets,
      liabilities,
      netWorth: assets - liabilities,
    };
  });
}
