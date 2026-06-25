import type {
  Budget,
  ExpenseCategory,
  FinancialPosition,
  IncomeSource,
  Transaction,
  Valuation,
} from "./types";

export const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const currentMonth = () => new Date().toISOString().slice(0, 7);
export const today = () => new Date().toISOString().slice(0, 10);

export function formatMonth(month: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-02T00:00:00`));
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function isIncomeActive(source: IncomeSource, month: string) {
  return source.startMonth <= month && (!source.endMonth || source.endMonth >= month);
}

export function getMonthSummary(
  month: string,
  transactions: Transaction[],
  incomeSources: IncomeSource[],
  budgets: Budget[],
) {
  const monthTransactions = transactions.filter((item) =>
    item.date.startsWith(month),
  );
  const expenses = monthTransactions
    .filter((item) => item.type === "expense")
    .reduce((total, item) => total + item.amount, 0);
  const oneOffIncome = monthTransactions
    .filter((item) => item.type === "income")
    .reduce((total, item) => total + item.amount, 0);
  const recurringIncome = incomeSources
    .filter((source) => isIncomeActive(source, month))
    .reduce((total, source) => total + source.monthlyAmount, 0);
  const budget = budgets
    .filter((item) => item.month === month)
    .reduce((total, item) => total + item.amount, 0);

  return {
    expenses,
    income: recurringIncome + oneOffIncome,
    recurringIncome,
    oneOffIncome,
    budget,
    remaining: budget - expenses,
    balance: recurringIncome + oneOffIncome - expenses,
  };
}

export function spendByCategory(
  month: string,
  transactions: Transaction[],
  budgets: Budget[],
) {
  const expenses = transactions.filter(
    (item) => item.type === "expense" && item.date.startsWith(month),
  );
  const categories = new Set<ExpenseCategory>();
  expenses.forEach((item) => categories.add(item.category as ExpenseCategory));
  budgets
    .filter((item) => item.month === month)
    .forEach((item) => categories.add(item.category));

  return [...categories]
    .map((category) => ({
      category,
      spent: expenses
        .filter((item) => item.category === category)
        .reduce((total, item) => total + item.amount, 0),
      budget:
        budgets.find(
          (item) => item.month === month && item.category === category,
        )?.amount ?? 0,
    }))
    .sort((a, b) => b.spent - a.spent);
}

export function makeId() {
  return crypto.randomUUID();
}

export function latestValuation(
  position: FinancialPosition,
  asOfDate?: string,
): Valuation | null {
  return (
    [...position.valuations]
      .filter((valuation) => !asOfDate || valuation.date <= asOfDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
  );
}

export function getNetWorthSummary(
  positions: FinancialPosition[],
  asOfDate?: string,
) {
  const valued = positions.map((position) => ({
    position,
    valuation: latestValuation(position, asOfDate),
  }));
  const assets = valued
    .filter((item) => item.position.kind === "asset")
    .reduce((sum, item) => sum + (item.valuation?.value ?? 0), 0);
  const liabilities = valued
    .filter((item) => item.position.kind === "liability")
    .reduce((sum, item) => sum + (item.valuation?.value ?? 0), 0);

  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
  };
}

export function netWorthHistory(positions: FinancialPosition[]) {
  const dates = [
    ...new Set(
      positions.flatMap((position) =>
        position.valuations.map((valuation) => valuation.date),
      ),
    ),
  ].sort();

  return dates.map((date) => ({
    date,
    ...getNetWorthSummary(positions, date),
  }));
}
