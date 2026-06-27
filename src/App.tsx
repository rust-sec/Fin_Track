import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, getStoredToken, type Session } from "./api";
import { NetWorth } from "./NetWorth";
import {
  EXPENSE_CATEGORIES,
  type Budget,
  type FinanceData,
  type IncomeSource,
  type Transaction,
  type TransactionType,
  type View,
} from "./types";
import {
  currency,
  currentMonth,
  formatDate,
  formatMonth,
  getMonthSummary,
  getNetWorthSummary,
  makeId,
  spendByCategory,
  today,
} from "./utils";

const navItems: Array<{ view: View; icon: string; label: string }> = [
  { view: "dashboard", icon: "⌂", label: "Dashboard" },
  { view: "transactions", icon: "↔", label: "Transactions" },
  { view: "income", icon: "↗", label: "Income setup" },
  { view: "budgets", icon: "◎", label: "Budgets" },
  { view: "networth", icon: "◇", label: "Net worth" },
];

const emptyData: FinanceData = {
  transactions: [],
  incomeSources: [],
  budgets: [],
  positions: [],
};

function App() {
  const [data, setData] = useState<FinanceData>(emptyData);
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [transactionModal, setTransactionModal] = useState(false);

  const refreshData = async (familyId = session?.familyId) => {
    if (!familyId) return;
    setData(await api.loadFinanceData(familyId));
  };

  useEffect(() => {
    const bootstrap = async () => {
      const token = getStoredToken();
      if (!token) {
        setAuthChecked(true);
        return;
      }

      try {
        const current = await api.me();
        const familyId = current.memberships[0]?.familyId;
        if (!familyId) throw new Error("No family found for this account");
        setSession({ accessToken: token, user: current.user, familyId });
        setData(await api.loadFinanceData(familyId));
      } catch {
        await api.logout();
      } finally {
        setAuthChecked(true);
      }
    };

    void bootstrap();
  }, []);

  const summary = useMemo(
    () =>
      getMonthSummary(
        selectedMonth,
        data.transactions,
        data.incomeSources,
        data.budgets,
      ),
    [data, selectedMonth],
  );

  const addTransaction = async (transaction: Transaction) => {
    if (!session) return;
    setError("");
    try {
      await api.createTransaction(session.familyId, transaction);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save transaction");
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!session) return;
    if (!window.confirm("Delete this transaction?")) return;
    setError("");
    try {
      await api.deleteTransaction(session.familyId, id);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete transaction");
    }
  };

  const syncIncomeSources = async (nextSources: IncomeSource[]) => {
    if (!session) return;
    setError("");
    try {
      const previous = data.incomeSources;
      const removed = previous.filter((item) => !nextSources.some((next) => next.id === item.id));
      const added = nextSources.filter((item) => !previous.some((old) => old.id === item.id));
      const updated = nextSources.filter((item) => {
        const old = previous.find((source) => source.id === item.id);
        return old && JSON.stringify(old) !== JSON.stringify(item);
      });

      await Promise.all([
        ...removed.map((source) => api.deleteIncomeSource(session.familyId, source.id)),
        ...added.map((source) => api.createIncomeSource(session.familyId, source)),
        ...updated.map((source) => api.updateIncomeSource(session.familyId, source)),
      ]);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save income sources");
    }
  };

  const syncBudgets = async (nextBudgets: Budget[]) => {
    if (!session) return;
    setError("");
    try {
      const categories = new Set([
        ...data.budgets.filter((item) => item.month === selectedMonth).map((item) => item.category),
        ...nextBudgets.filter((item) => item.month === selectedMonth).map((item) => item.category),
      ]);

      await Promise.all(
        [...categories].map((category) => {
          const nextAmount =
            nextBudgets.find((item) => item.month === selectedMonth && item.category === category)
              ?.amount ?? 0;
          const previousAmount =
            data.budgets.find((item) => item.month === selectedMonth && item.category === category)
              ?.amount ?? 0;
          if (nextAmount === previousAmount) return Promise.resolve();
          return api.setBudget(session.familyId, {
            id: "",
            month: selectedMonth,
            category,
            amount: nextAmount,
          });
        }),
      );
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save budgets");
    }
  };

  const syncPositions = async (nextPositions: FinanceData["positions"]) => {
    if (!session) return;
    setError("");
    try {
      const previous = data.positions;
      const removed = previous.filter((item) => !nextPositions.some((next) => next.id === item.id));
      const added = nextPositions.filter((item) => !previous.some((old) => old.id === item.id));
      const updated = nextPositions.filter((item) => {
        const old = previous.find((position) => position.id === item.id);
        if (!old) return false;
        const oldCore = { ...old, valuations: undefined };
        const nextCore = { ...item, valuations: undefined };
        return JSON.stringify(oldCore) !== JSON.stringify(nextCore);
      });
      const newValuations = nextPositions.flatMap((position) => {
        const old = previous.find((item) => item.id === position.id);
        if (!old) return [];
        return position.valuations
          .filter((valuation) => !old.valuations.some((item) => item.id === valuation.id))
          .map((valuation) => ({ positionId: position.id, valuation }));
      });

      await Promise.all([
        ...removed.map((position) => api.deletePosition(session.familyId, position.id)),
        ...added.map((position) => api.createPosition(session.familyId, position)),
        ...updated.map((position) => api.updatePosition(session.familyId, position)),
        ...newValuations.map(({ positionId, valuation }) =>
          api.addValuation(session.familyId, positionId, valuation),
        ),
      ]);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save financial positions");
    }
  };

  if (!authChecked) {
    return <FullPageMessage title="Loading" text="Checking your session..." />;
  }

  if (!session) {
    return (
      <AuthScreen
        loading={loading}
        error={error}
        onSubmit={async (mode, input) => {
          setLoading(true);
          setError("");
          try {
            const nextSession =
              mode === "login"
                ? await api.login({ email: input.email, password: input.password })
                : await api.register({
                    name: input.name,
                    email: input.email,
                    password: input.password,
                    familyName: input.familyName,
                  });
            setSession(nextSession);
            setData(await api.loadFinanceData(nextSession.familyId));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Authentication failed");
          } finally {
            setLoading(false);
          }
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">₹</span>
          <div>
            <strong>Family Finance</strong>
            <span>Simple money tracking</span>
          </div>
        </div>

        <nav>
          {navItems.map((item) => (
            <button
              className={view === item.view ? "nav-item active" : "nav-item"}
              key={item.view}
              onClick={() => setView(item.view)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <span>{session.user.name}</span>
          <p>Data is stored in your family database.</p>
          <button
            className="text-button"
            onClick={async () => {
              await api.logout();
              setSession(null);
              setData(emptyData);
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="mobile-brand" onClick={() => setView("dashboard")}>
            ₹
          </button>
          <div className="month-picker">
            <span>Viewing</span>
            <input
              aria-label="Selected month"
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            />
          </div>
          <button className="primary-button" onClick={() => setTransactionModal(true)}>
            <span>＋</span> Add transaction
          </button>
        </header>

        <section className="content">
          {error && <div className="error-banner">{error}</div>}
          {view === "dashboard" && (
            <Dashboard
              data={data}
              month={selectedMonth}
              summary={summary}
              onAddTransaction={() => setTransactionModal(true)}
              onNavigate={setView}
            />
          )}
          {view === "transactions" && (
            <Transactions
              transactions={data.transactions}
              month={selectedMonth}
              onAdd={() => setTransactionModal(true)}
              onDelete={deleteTransaction}
            />
          )}
          {view === "income" && (
            <IncomeSetup
              sources={data.incomeSources}
              onChange={(incomeSources) => void syncIncomeSources(incomeSources)}
            />
          )}
          {view === "budgets" && (
            <Budgets
              budgets={data.budgets}
              transactions={data.transactions}
              month={selectedMonth}
              onChange={(budgets) => void syncBudgets(budgets)}
            />
          )}
          {view === "networth" && (
            <NetWorth
              positions={data.positions}
              onChange={(positions) => void syncPositions(positions)}
            />
          )}
        </section>
      </main>

      {transactionModal && (
        <TransactionModal
          onClose={() => setTransactionModal(false)}
          onSave={(transaction) => {
            void addTransaction(transaction);
            setTransactionModal(false);
          }}
        />
      )}

      <div className="mobile-nav">
        {navItems.map((item) => (
          <button
            className={view === item.view ? "active" : ""}
            key={item.view}
            onClick={() => setView(item.view)}
          >
            <span>{item.icon}</span>
            {item.label.split(" ")[0]}
          </button>
        ))}
      </div>
    </div>
  );
}

interface DashboardProps {
  data: FinanceData;
  month: string;
  summary: ReturnType<typeof getMonthSummary>;
  onAddTransaction: () => void;
  onNavigate: (view: View) => void;
}

function Dashboard({
  data,
  month,
  summary,
  onAddTransaction,
  onNavigate,
}: DashboardProps) {
  const categoryData = spendByCategory(month, data.transactions, data.budgets);
  const positionSummary = getNetWorthSummary(
    data.positions,
    `${month}-31`,
  );
  const recent = data.transactions
    .filter((item) => item.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const usedPercent =
    summary.budget > 0 ? Math.min((summary.expenses / summary.budget) * 100, 100) : 0;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{formatMonth(month)}</p>
          <h1>Money at a glance</h1>
          <p>Track your family’s monthly plan and spending.</p>
        </div>
      </div>

      <div className="summary-grid">
        <SummaryCard
          label="Total income"
          value={summary.income}
          note={`${currency.format(summary.recurringIncome)} recurring`}
          tone="green"
          icon="↗"
        />
        <SummaryCard
          label="Total spent"
          value={summary.expenses}
          note={`${summary.budget ? Math.round((summary.expenses / summary.budget) * 100) : 0}% of budget`}
          tone="orange"
          icon="↘"
        />
        <SummaryCard
          label="Available balance"
          value={summary.balance}
          note="Income minus spending"
          tone="blue"
          icon="◈"
        />
        <SummaryCard
          label="Net worth"
          value={positionSummary.netWorth}
          note={`${currency.format(positionSummary.assets)} in assets`}
          tone="purple"
          icon="◇"
        />
      </div>

      <article className="financial-position-strip">
        <div>
          <span>Family financial position</span>
          <strong>{currency.format(positionSummary.assets)}</strong>
          <small>Total assets</small>
        </div>
        <span className="position-minus">−</span>
        <div>
          <span>Outstanding debt</span>
          <strong>{currency.format(positionSummary.liabilities)}</strong>
          <small>Total liabilities</small>
        </div>
        <span className="position-equals">=</span>
        <div>
          <span>Net worth</span>
          <strong>{currency.format(positionSummary.netWorth)}</strong>
          <button className="text-button" onClick={() => onNavigate("networth")}>
            View position
          </button>
        </div>
      </article>

      <div className="dashboard-grid">
        <article className="panel budget-overview">
          <div className="panel-heading">
            <div>
              <h2>Monthly budget</h2>
              <p>Your spending progress across all categories.</p>
            </div>
            <button className="text-button" onClick={() => onNavigate("budgets")}>
              Manage budget
            </button>
          </div>
          {summary.budget > 0 ? (
            <>
              <div className="budget-total-row">
                <div>
                  <span>Spent</span>
                  <strong>{currency.format(summary.expenses)}</strong>
                </div>
                <div className="align-right">
                  <span>Budget</span>
                  <strong>{currency.format(summary.budget)}</strong>
                </div>
              </div>
              <div className="progress large">
                <span style={{ width: `${usedPercent}%` }} />
              </div>
              <p className={summary.remaining < 0 ? "status danger" : "status"}>
                {summary.remaining >= 0
                  ? `${currency.format(summary.remaining)} left to spend`
                  : `${currency.format(Math.abs(summary.remaining))} over budget`}
              </p>
              <div className="category-bars">
                {categoryData.slice(0, 5).map((item) => {
                  const percent =
                    item.budget > 0
                      ? Math.min((item.spent / item.budget) * 100, 100)
                      : item.spent > 0
                        ? 100
                        : 0;
                  return (
                    <div className="category-row" key={item.category}>
                      <div className="category-label">
                        <span>{item.category}</span>
                        <span>
                          {currency.format(item.spent)} / {currency.format(item.budget)}
                        </span>
                      </div>
                      <div className="progress small">
                        <span
                          className={item.spent > item.budget && item.budget > 0 ? "over" : ""}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyState
              icon="◎"
              title="No budget for this month"
              text="Set category limits to see how spending compares with your plan."
              action="Set a budget"
              onAction={() => onNavigate("budgets")}
            />
          )}
        </article>

        <article className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Latest entries this month.</p>
            </div>
            <button className="text-button" onClick={() => onNavigate("transactions")}>
              View all
            </button>
          </div>
          {recent.length ? (
            <div className="activity-list">
              {recent.map((item) => (
                <TransactionRow key={item.id} transaction={item} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="↔"
              title="No transactions yet"
              text="Add your first expense or one-off income."
              action="Add transaction"
              onAction={onAddTransaction}
            />
          )}
        </article>
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  note,
  tone,
  icon,
}: {
  label: string;
  value: number;
  note: string;
  tone: string;
  icon: string;
}) {
  return (
    <article className="summary-card">
      <div className={`summary-icon ${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{currency.format(value)}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function Transactions({
  transactions,
  month,
  onAdd,
  onDelete,
}: {
  transactions: Transaction[];
  month: string;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [search, setSearch] = useState("");
  const visible = transactions
    .filter((item) => item.date.startsWith(month))
    .filter((item) => typeFilter === "all" || item.type === typeFilter)
    .filter((item) =>
      `${item.description} ${item.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <div className="page-heading split">
        <div>
          <p className="eyebrow">{formatMonth(month)}</p>
          <h1>Transactions</h1>
          <p>All expenses and one-off income logged for this month.</p>
        </div>
        <button className="primary-button" onClick={onAdd}>
          ＋ Add transaction
        </button>
      </div>
      <article className="panel table-panel">
        <div className="filters">
          <input
            className="search-input"
            placeholder="Search transactions"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as "all" | TransactionType)
            }
          >
            <option value="all">All types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>
        </div>
        {visible.length ? (
          <div className="transaction-table">
            <div className="table-header">
              <span>Description</span>
              <span>Category</span>
              <span>Date</span>
              <span>Amount</span>
              <span />
            </div>
            {visible.map((item) => (
              <div className="table-row" key={item.id}>
                <span className="description-cell">
                  <i className={item.type}>{item.type === "expense" ? "↘" : "↗"}</i>
                  <strong>{item.description}</strong>
                </span>
                <span>{item.category}</span>
                <span>{formatDate(item.date)}</span>
                <strong className={item.type}>
                  {item.type === "expense" ? "−" : "+"}
                  {currency.format(item.amount)}
                </strong>
                <button
                  className="delete-button"
                  aria-label={`Delete ${item.description}`}
                  onClick={() => onDelete(item.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="↔"
            title="No matching transactions"
            text="Try a different filter or add a new entry."
            action="Add transaction"
            onAction={onAdd}
          />
        )}
      </article>
    </>
  );
}

function IncomeSetup({
  sources,
  onChange,
}: {
  sources: IncomeSource[];
  onChange: (sources: IncomeSource[]) => void;
}) {
  const [editing, setEditing] = useState<IncomeSource | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const annualTotal = sources.reduce(
    (total, source) => total + source.monthlyAmount * 12,
    0,
  );

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const save = (source: IncomeSource) => {
    const exists = sources.some((item) => item.id === source.id);
    onChange(
      exists
        ? sources.map((item) => (item.id === source.id ? source : item))
        : [...sources, source],
    );
    setFormOpen(false);
  };

  return (
    <>
      <div className="page-heading split">
        <div>
          <p className="eyebrow">Recurring income</p>
          <h1>Income setup</h1>
          <p>Enter stable monthly income once. Edit it only when something changes.</p>
        </div>
        <button className="primary-button" onClick={openNew}>
          ＋ Add income source
        </button>
      </div>

      <div className="info-banner">
        <span>i</span>
        <p>
          Recurring income is automatically included in every active month. Bonuses,
          refunds, or irregular income should be added as one-off transactions.
        </p>
      </div>

      <div className="income-summary">
        <div>
          <span>Estimated yearly recurring income</span>
          <strong>{currency.format(annualTotal)}</strong>
        </div>
        <div>
          <span>Monthly recurring income</span>
          <strong>
            {currency.format(sources.reduce((sum, item) => sum + item.monthlyAmount, 0))}
          </strong>
        </div>
      </div>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <h2>Income sources</h2>
            <p>Salary, pension, rent, or other predictable family income.</p>
          </div>
        </div>
        {sources.length ? (
          <div className="source-list">
            {sources.map((source) => (
              <div className="source-card" key={source.id}>
                <div className="source-icon">₹</div>
                <div className="source-details">
                  <strong>{source.name}</strong>
                  <span>
                    Active from {formatMonth(source.startMonth)}
                    {source.endMonth ? ` to ${formatMonth(source.endMonth)}` : ""}
                  </span>
                </div>
                <strong className="source-amount">
                  {currency.format(source.monthlyAmount)}
                  <small>/ month</small>
                </strong>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setEditing(source);
                    setFormOpen(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="delete-button"
                  aria-label={`Delete ${source.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete ${source.name}?`)) {
                      onChange(sources.filter((item) => item.id !== source.id));
                    }
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="₹"
            title="Add your regular income once"
            text="The dashboard will automatically count it each month."
            action="Add income source"
            onAction={openNew}
          />
        )}
      </article>

      {formOpen && (
        <IncomeModal
          source={editing}
          onClose={() => setFormOpen(false)}
          onSave={save}
        />
      )}
    </>
  );
}

function Budgets({
  budgets,
  transactions,
  month,
  onChange,
}: {
  budgets: Budget[];
  transactions: Transaction[];
  month: string;
  onChange: (budgets: Budget[]) => void;
}) {
  const monthBudgets = budgets.filter((item) => item.month === month);
  const categoryData = spendByCategory(month, transactions, budgets);
  const total = monthBudgets.reduce((sum, item) => sum + item.amount, 0);

  const setCategoryBudget = (category: (typeof EXPENSE_CATEGORIES)[number], amount: number) => {
    const remaining = budgets.filter(
      (item) => !(item.month === month && item.category === category),
    );
    if (amount > 0) {
      remaining.push({ id: makeId(), month, category, amount });
    }
    onChange(remaining);
  };

  const copyPreviousMonth = () => {
    const date = new Date(`${month}-02T00:00:00`);
    date.setMonth(date.getMonth() - 1);
    const previous = date.toISOString().slice(0, 7);
    const previousBudgets = budgets.filter((item) => item.month === previous);
    if (!previousBudgets.length) {
      window.alert(`No budget found for ${formatMonth(previous)}.`);
      return;
    }
    const withoutCurrent = budgets.filter((item) => item.month !== month);
    onChange([
      ...withoutCurrent,
      ...previousBudgets.map((item) => ({
        ...item,
        id: makeId(),
        month,
      })),
    ]);
  };

  return (
    <>
      <div className="page-heading split">
        <div>
          <p className="eyebrow">{formatMonth(month)}</p>
          <h1>Monthly budget</h1>
          <p>Set a practical spending limit for each category.</p>
        </div>
        <button className="secondary-button" onClick={copyPreviousMonth}>
          Copy previous month
        </button>
      </div>

      <div className="budget-editor-summary">
        <span>Total monthly budget</span>
        <strong>{currency.format(total)}</strong>
        <small>Changes are saved automatically</small>
      </div>

      <article className="panel budget-editor">
        <div className="budget-editor-header">
          <span>Category</span>
          <span>Budget amount</span>
          <span>Spent</span>
          <span>Progress</span>
        </div>
        {EXPENSE_CATEGORIES.map((category) => {
          const budget = monthBudgets.find((item) => item.category === category)?.amount ?? 0;
          const spent = categoryData.find((item) => item.category === category)?.spent ?? 0;
          const percent = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
          return (
            <div className="budget-editor-row" key={category}>
              <strong>{category}</strong>
              <label className="currency-input">
                <span>₹</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={budget || ""}
                  placeholder="0"
                  onChange={(event) =>
                    setCategoryBudget(category, Number(event.target.value))
                  }
                />
              </label>
              <span>{currency.format(spent)}</span>
              <div className="budget-progress-cell">
                <div className="progress small">
                  <span
                    className={spent > budget && budget > 0 ? "over" : ""}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <small>{budget ? `${Math.round((spent / budget) * 100)}%` : "—"}</small>
              </div>
            </div>
          );
        })}
      </article>
    </>
  );
}

function TransactionModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<(typeof EXPENSE_CATEGORIES)[number]>(
    "Groceries",
  );
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0 || !description.trim()) return;
    onSave({
      id: makeId(),
      type,
      amount: parsedAmount,
      category: type === "income" ? "Income" : category,
      description: description.trim(),
      date,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <Modal title="Add transaction" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="type-toggle">
          <button
            type="button"
            className={type === "expense" ? "active expense" : ""}
            onClick={() => setType("expense")}
          >
            Expense
          </button>
          <button
            type="button"
            className={type === "income" ? "active income" : ""}
            onClick={() => setType("income")}
          >
            One-off income
          </button>
        </div>
        <label className="form-field amount-field">
          <span>Amount</span>
          <div>
            <i>₹</i>
            <input
              autoFocus
              required
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
        </label>
        <div className="form-grid">
          {type === "expense" && (
            <label className="form-field">
              <span>Category</span>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target.value as (typeof EXPENSE_CATEGORIES)[number],
                  )
                }
              >
                {EXPENSE_CATEGORIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          )}
          <label className="form-field">
            <span>Date</span>
            <input
              required
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>
        <label className="form-field">
          <span>Description</span>
          <input
            required
            maxLength={80}
            placeholder={type === "expense" ? "e.g. Weekly groceries" : "e.g. Tax refund"}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Save transaction
          </button>
        </div>
      </form>
    </Modal>
  );
}

function IncomeModal({
  source,
  onClose,
  onSave,
}: {
  source: IncomeSource | null;
  onClose: () => void;
  onSave: (source: IncomeSource) => void;
}) {
  const [name, setName] = useState(source?.name ?? "");
  const [amount, setAmount] = useState(source?.monthlyAmount.toString() ?? "");
  const [startMonth, setStartMonth] = useState(source?.startMonth ?? currentMonth());
  const [endMonth, setEndMonth] = useState(source?.endMonth ?? "");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const monthlyAmount = Number(amount);
    if (!name.trim() || monthlyAmount <= 0) return;
    onSave({
      id: source?.id ?? makeId(),
      name: name.trim(),
      monthlyAmount,
      startMonth,
      endMonth: endMonth || null,
      createdAt: source?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <Modal title={source ? "Edit income source" : "Add income source"} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="form-field">
          <span>Income name</span>
          <input
            autoFocus
            required
            placeholder="e.g. Primary salary"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="form-field amount-field">
          <span>Monthly amount</span>
          <div>
            <i>₹</i>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
        </label>
        <div className="form-grid">
          <label className="form-field">
            <span>Starts in</span>
            <input
              required
              type="month"
              value={startMonth}
              onChange={(event) => setStartMonth(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Ends in (optional)</span>
            <input
              type="month"
              min={startMonth}
              value={endMonth}
              onChange={(event) => setEndMonth(event.target.value)}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Save income
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Family Finance</p>
            <h2>{title}</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  return (
    <div className="activity-row">
      <i className={transaction.type}>{transaction.type === "expense" ? "↘" : "↗"}</i>
      <div>
        <strong>{transaction.description}</strong>
        <span>
          {transaction.category} · {formatDate(transaction.date)}
        </span>
      </div>
      <strong className={transaction.type}>
        {transaction.type === "expense" ? "−" : "+"}
        {currency.format(transaction.amount)}
      </strong>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <i>{icon}</i>
      <strong>{title}</strong>
      <p>{text}</p>
      <button className="secondary-button" onClick={onAction}>
        {action}
      </button>
    </div>
  );
}

export default App;

function FullPageMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="auth-page">
      <div className="auth-card compact">
        <span className="brand-mark">₹</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}

function AuthScreen({
  loading,
  error,
  onSubmit,
}: {
  loading: boolean;
  error: string;
  onSubmit: (
    mode: "login" | "register",
    input: { name: string; email: string; password: string; familyName: string },
  ) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [familyName, setFamilyName] = useState("My Family");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit(mode, { name, email, password, familyName });
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand auth-brand">
          <span className="brand-mark">₹</span>
          <div>
            <strong>Family Finance</strong>
            <span>Private family money tracking</span>
          </div>
        </div>

        <div className="type-toggle">
          <button
            type="button"
            className={mode === "login" ? "active income" : ""}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "register" ? "active income" : ""}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        {mode === "register" && (
          <>
            <label className="form-field">
              <span>Your name</span>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Satya"
              />
            </label>
            <label className="form-field">
              <span>Family name</span>
              <input
                required
                value={familyName}
                onChange={(event) => setFamilyName(event.target.value)}
                placeholder="e.g. Sharma Family"
              />
            </label>
          </>
        )}

        <label className="form-field">
          <span>Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className="form-field">
          <span>Password</span>
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
          />
        </label>

        {error && <div className="error-banner">{error}</div>}

        <button className="primary-button auth-submit" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
