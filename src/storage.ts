import type { FinanceData } from "./types";

const STORAGE_KEY = "family-finance-data-v1";

const EMPTY_DATA: FinanceData = {
  transactions: [],
  incomeSources: [],
  budgets: [],
  positions: [],
};

export function loadFinanceData(): FinanceData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DATA;
    const parsed = JSON.parse(raw) as Partial<FinanceData>;
    return {
      transactions: parsed.transactions ?? [],
      incomeSources: parsed.incomeSources ?? [],
      budgets: parsed.budgets ?? [],
      positions: parsed.positions ?? [],
    };
  } catch {
    return EMPTY_DATA;
  }
}

export function saveFinanceData(data: FinanceData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
