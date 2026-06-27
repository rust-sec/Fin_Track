import type {
  Budget,
  FinanceData,
  FinancialPosition,
  IncomeSource,
  Transaction,
  Valuation,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "fin-track-access-token";

export interface Session {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  familyId: string;
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function monthOnly(value: string) {
  return value.slice(0, 7);
}

function mapTransaction(item: any): Transaction {
  return {
    id: item.id,
    type: item.type.toLowerCase(),
    amount: Number(item.amount),
    category: item.category,
    description: item.description,
    date: dateOnly(item.date),
    createdAt: item.createdAt,
  };
}

function mapIncomeSource(item: any): IncomeSource {
  return {
    id: item.id,
    name: item.name,
    monthlyAmount: Number(item.monthlyAmount),
    startMonth: monthOnly(item.startMonth),
    endMonth: item.endMonth ? monthOnly(item.endMonth) : null,
    createdAt: item.createdAt,
  };
}

function mapBudget(item: any): Budget {
  return {
    id: item.id,
    month: monthOnly(item.month),
    category: item.category,
    amount: Number(item.amount),
  };
}

function mapValuation(item: any): Valuation {
  return {
    id: item.id,
    date: dateOnly(item.valuationDate),
    value: Number(item.value),
    note: item.note ?? "",
  };
}

function mapPosition(item: any): FinancialPosition {
  return {
    id: item.id,
    kind: item.kind.toLowerCase(),
    name: item.name,
    category: item.category,
    owner: item.owner ?? "",
    notes: item.notes ?? "",
    valuations: (item.valuations ?? []).map(mapValuation),
    createdAt: item.createdAt,
  };
}

export const api = {
  async register(input: {
    name: string;
    email: string;
    password: string;
    familyName: string;
    baseCurrency?: string;
  }) {
    const session = await request<Session>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...input, baseCurrency: input.baseCurrency ?? "INR" }),
    });
    setStoredToken(session.accessToken);
    return session;
  },

  async login(input: { email: string; password: string }) {
    const session = await request<Session>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setStoredToken(session.accessToken);
    return session;
  },

  async logout() {
    await request<{ ok: boolean }>("/auth/logout", { method: "POST" }).catch(() => null);
    setStoredToken(null);
  },

  async me() {
    return request<{
      user: Session["user"];
      memberships: Array<{ familyId: string; family: { id: string; name: string } }>;
    }>("/auth/me");
  },

  async loadFinanceData(familyId: string): Promise<FinanceData> {
    const [transactions, incomeSources, budgets, positions] = await Promise.all([
      request<any[]>(`/families/${familyId}/transactions`),
      request<any[]>(`/families/${familyId}/income-sources`),
      request<any[]>(`/families/${familyId}/budgets`),
      request<any[]>(`/families/${familyId}/positions`),
    ]);

    return {
      transactions: transactions.map(mapTransaction),
      incomeSources: incomeSources.map(mapIncomeSource),
      budgets: budgets.map(mapBudget).filter((budget) => budget.amount > 0),
      positions: positions.map(mapPosition),
    };
  },

  async createTransaction(familyId: string, transaction: Transaction) {
    await request(`/families/${familyId}/transactions`, {
      method: "POST",
      body: JSON.stringify({
        type: transaction.type.toUpperCase(),
        date: transaction.date,
        amount: transaction.amount,
        category: transaction.category,
        description: transaction.description,
      }),
    });
  },

  async deleteTransaction(familyId: string, id: string) {
    await request(`/families/${familyId}/transactions/${id}`, { method: "DELETE" });
  },

  async createIncomeSource(familyId: string, source: IncomeSource) {
    await request(`/families/${familyId}/income-sources`, {
      method: "POST",
      body: JSON.stringify(source),
    });
  },

  async updateIncomeSource(familyId: string, source: IncomeSource) {
    await request(`/families/${familyId}/income-sources/${source.id}`, {
      method: "PUT",
      body: JSON.stringify(source),
    });
  },

  async deleteIncomeSource(familyId: string, id: string) {
    await request(`/families/${familyId}/income-sources/${id}`, { method: "DELETE" });
  },

  async setBudget(familyId: string, budget: Budget) {
    await request(`/families/${familyId}/budgets`, {
      method: "PUT",
      body: JSON.stringify(budget),
    });
  },

  async createPosition(familyId: string, position: FinancialPosition) {
    const opening = position.valuations[0];
    await request(`/families/${familyId}/positions`, {
      method: "POST",
      body: JSON.stringify({
        kind: position.kind.toUpperCase(),
        category: position.category,
        name: position.name,
        owner: position.owner,
        notes: position.notes,
        currentValue: opening?.value,
        valuationDate: opening?.date,
      }),
    });
  },

  async updatePosition(familyId: string, position: FinancialPosition) {
    await request(`/families/${familyId}/positions/${position.id}`, {
      method: "PUT",
      body: JSON.stringify({
        kind: position.kind.toUpperCase(),
        category: position.category,
        name: position.name,
        owner: position.owner,
        notes: position.notes,
      }),
    });
  },

  async deletePosition(familyId: string, id: string) {
    await request(`/families/${familyId}/positions/${id}`, { method: "DELETE" });
  },

  async addValuation(familyId: string, positionId: string, valuation: Valuation) {
    await request(`/families/${familyId}/positions/${positionId}/valuations`, {
      method: "POST",
      body: JSON.stringify({
        valuationDate: valuation.date,
        value: valuation.value,
        note: valuation.note,
      }),
    });
  },
};
