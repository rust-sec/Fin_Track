export const EXPENSE_CATEGORIES = [
  "Housing",
  "Groceries",
  "Transport",
  "Utilities",
  "Health",
  "Education",
  "Entertainment",
  "Shopping",
  "Dining",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type TransactionType = "expense" | "income";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: ExpenseCategory | "Income";
  description: string;
  date: string;
  createdAt: string;
}

export interface IncomeSource {
  id: string;
  name: string;
  monthlyAmount: number;
  startMonth: string;
  endMonth: string | null;
  createdAt: string;
}

export interface Budget {
  id: string;
  month: string;
  category: ExpenseCategory;
  amount: number;
}

export const ASSET_CATEGORIES = [
  "Bank account",
  "Cash",
  "Fixed deposit",
  "Mutual funds",
  "Stocks",
  "Retirement",
  "Gold",
  "Property",
  "Vehicle",
  "Other asset",
] as const;

export const LIABILITY_CATEGORIES = [
  "Home loan",
  "Vehicle loan",
  "Personal loan",
  "Education loan",
  "Credit card",
  "Other debt",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];
export type LiabilityCategory = (typeof LIABILITY_CATEGORIES)[number];
export type PositionKind = "asset" | "liability";

export interface Valuation {
  id: string;
  date: string;
  value: number;
  note: string;
}

export interface FinancialPosition {
  id: string;
  kind: PositionKind;
  name: string;
  category: AssetCategory | LiabilityCategory;
  owner: string;
  notes: string;
  valuations: Valuation[];
  createdAt: string;
}

export interface FinanceData {
  transactions: Transaction[];
  incomeSources: IncomeSource[];
  budgets: Budget[];
  positions: FinancialPosition[];
}

export type View =
  | "dashboard"
  | "transactions"
  | "income"
  | "budgets"
  | "networth";
