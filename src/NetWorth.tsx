import { FormEvent, useMemo, useState } from "react";
import {
  ASSET_CATEGORIES,
  LIABILITY_CATEGORIES,
  type AssetCategory,
  type FinancialPosition,
  type LiabilityCategory,
  type PositionKind,
} from "./types";
import {
  currency,
  formatDate,
  getNetWorthSummary,
  latestValuation,
  makeId,
  netWorthHistory,
  today,
} from "./utils";

export function NetWorth({
  positions,
  onChange,
}: {
  positions: FinancialPosition[];
  onChange: (positions: FinancialPosition[]) => void;
}) {
  const [positionModal, setPositionModal] = useState(false);
  const [editing, setEditing] = useState<FinancialPosition | null>(null);
  const [valuationPosition, setValuationPosition] =
    useState<FinancialPosition | null>(null);
  const [filter, setFilter] = useState<"all" | PositionKind>("all");
  const summary = getNetWorthSummary(positions);
  const history = netWorthHistory(positions);
  const visible = positions.filter(
    (position) => filter === "all" || position.kind === filter,
  );

  const assetAllocation = useMemo(() => {
    const totals = new Map<string, number>();
    positions
      .filter((position) => position.kind === "asset")
      .forEach((position) => {
        const value = latestValuation(position)?.value ?? 0;
        totals.set(position.category, (totals.get(position.category) ?? 0) + value);
      });
    return [...totals.entries()]
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);
  }, [positions]);

  const savePosition = (position: FinancialPosition) => {
    const exists = positions.some((item) => item.id === position.id);
    onChange(
      exists
        ? positions.map((item) => (item.id === position.id ? position : item))
        : [...positions, position],
    );
    setPositionModal(false);
  };

  return (
    <>
      <div className="page-heading split">
        <div>
          <p className="eyebrow">Financial position</p>
          <h1>Net worth</h1>
          <p>Track what your family owns and owes using dated balance updates.</p>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            setEditing(null);
            setPositionModal(true);
          }}
        >
          ＋ Add asset or debt
        </button>
      </div>

      <div className="summary-grid">
        <PositionSummary label="Total assets" value={summary.assets} tone="green" />
        <PositionSummary
          label="Total liabilities"
          value={summary.liabilities}
          tone="orange"
        />
        <PositionSummary label="Net worth" value={summary.netWorth} tone="blue" />
      </div>

      <div className="position-dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Asset allocation</h2>
              <p>Current value grouped by asset type.</p>
            </div>
          </div>
          {assetAllocation.length ? (
            <div className="allocation-list">
              {assetAllocation.map((item, index) => (
                <div className="allocation-row" key={item.category}>
                  <span
                    className={`allocation-dot color-${(index % 5) + 1}`}
                  />
                  <strong>{item.category}</strong>
                  <div className="progress small">
                    <span
                      style={{
                        width: `${
                          summary.assets ? (item.value / summary.assets) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span>{currency.format(item.value)}</span>
                  <small>
                    {summary.assets
                      ? `${Math.round((item.value / summary.assets) * 100)}%`
                      : "0%"}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <PositionEmpty onAdd={() => setPositionModal(true)} />
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Net-worth history</h2>
              <p>Calculated from every dated valuation.</p>
            </div>
          </div>
          {history.length > 1 ? (
            <HistoryChart history={history} />
          ) : (
            <div className="history-placeholder">
              <span>↗</span>
              <strong>History builds over time</strong>
              <p>Add new valuations periodically to see your financial trajectory.</p>
            </div>
          )}
        </article>
      </div>

      <article className="panel positions-panel">
        <div className="panel-heading positions-heading">
          <div>
            <h2>Assets and liabilities</h2>
            <p>Update balances rather than replacing them to retain history.</p>
          </div>
          <div className="position-filter">
            {(["all", "asset", "liability"] as const).map((item) => (
              <button
                className={filter === item ? "active" : ""}
                key={item}
                onClick={() => setFilter(item)}
              >
                {item === "all" ? "All" : item === "asset" ? "Assets" : "Liabilities"}
              </button>
            ))}
          </div>
        </div>

        {visible.length ? (
          <div className="position-list">
            {visible
              .sort((a, b) => {
                if (a.kind !== b.kind) return a.kind === "asset" ? -1 : 1;
                return (
                  (latestValuation(b)?.value ?? 0) -
                  (latestValuation(a)?.value ?? 0)
                );
              })
              .map((position) => {
                const valuation = latestValuation(position);
                return (
                  <div className="position-row" key={position.id}>
                    <div className={`position-icon ${position.kind}`}>
                      {position.kind === "asset" ? "↗" : "↘"}
                    </div>
                    <div className="position-details">
                      <strong>{position.name}</strong>
                      <span>
                        {position.category}
                        {position.owner ? ` · ${position.owner}` : ""}
                      </span>
                    </div>
                    <div className="position-value">
                      <strong>{currency.format(valuation?.value ?? 0)}</strong>
                      <span>
                        {valuation ? `As of ${formatDate(valuation.date)}` : "No value"}
                      </span>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => setValuationPosition(position)}
                    >
                      Update value
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        setEditing(position);
                        setPositionModal(true);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
          </div>
        ) : (
          <PositionEmpty onAdd={() => setPositionModal(true)} />
        )}
      </article>

      {positionModal && (
        <PositionModal
          position={editing}
          onClose={() => setPositionModal(false)}
          onSave={savePosition}
          onDelete={
            editing
              ? () => {
                  if (window.confirm(`Delete ${editing.name} and its history?`)) {
                    onChange(positions.filter((item) => item.id !== editing.id));
                    setPositionModal(false);
                  }
                }
              : undefined
          }
        />
      )}

      {valuationPosition && (
        <ValuationModal
          position={valuationPosition}
          onClose={() => setValuationPosition(null)}
          onSave={(date, value, note) => {
            onChange(
              positions.map((position) =>
                position.id === valuationPosition.id
                  ? {
                      ...position,
                      valuations: [
                        ...position.valuations,
                        { id: makeId(), date, value, note },
                      ],
                    }
                  : position,
              ),
            );
            setValuationPosition(null);
          }}
        />
      )}
    </>
  );
}

function PositionSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <article className={`position-summary ${tone}`}>
      <span>{label}</span>
      <strong>{currency.format(value)}</strong>
    </article>
  );
}

function PositionModal({
  position,
  onClose,
  onSave,
  onDelete,
}: {
  position: FinancialPosition | null;
  onClose: () => void;
  onSave: (position: FinancialPosition) => void;
  onDelete?: () => void;
}) {
  const [kind, setKind] = useState<PositionKind>(position?.kind ?? "asset");
  const [name, setName] = useState(position?.name ?? "");
  const [category, setCategory] = useState(
    position?.category ?? ASSET_CATEGORIES[0],
  );
  const [owner, setOwner] = useState(position?.owner ?? "Family");
  const [notes, setNotes] = useState(position?.notes ?? "");
  const [initialValue, setInitialValue] = useState(
    position ? "" : "",
  );
  const [valueDate, setValueDate] = useState(today);
  const categories = kind === "asset" ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;

  const changeKind = (nextKind: PositionKind) => {
    setKind(nextKind);
    setCategory(
      nextKind === "asset" ? ASSET_CATEGORIES[0] : LIABILITY_CATEGORIES[0],
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const value = Number(initialValue);
    onSave({
      id: position?.id ?? makeId(),
      kind,
      name: name.trim(),
      category,
      owner: owner.trim(),
      notes: notes.trim(),
      valuations:
        position?.valuations ??
        (value > 0
          ? [{ id: makeId(), date: valueDate, value, note: "Opening value" }]
          : []),
      createdAt: position?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <SimpleModal
      title={position ? "Edit financial position" : "Add asset or liability"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="type-toggle">
          <button
            type="button"
            className={kind === "asset" ? "active income" : ""}
            onClick={() => changeKind("asset")}
          >
            Asset
          </button>
          <button
            type="button"
            className={kind === "liability" ? "active expense" : ""}
            onClick={() => changeKind("liability")}
          >
            Liability
          </button>
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>Name</span>
            <input
              autoFocus
              required
              placeholder="e.g. Primary savings account"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Category</span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value as AssetCategory | LiabilityCategory,
                )
              }
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="form-field">
          <span>Owner</span>
          <input
            placeholder="Family or member name"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          />
        </label>
        {!position && (
          <div className="form-grid">
            <label className="form-field amount-field">
              <span>Current value</span>
              <div>
                <i>₹</i>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={initialValue}
                  onChange={(event) => setInitialValue(event.target.value)}
                />
              </div>
            </label>
            <label className="form-field">
              <span>Value date</span>
              <input
                required
                type="date"
                value={valueDate}
                onChange={(event) => setValueDate(event.target.value)}
              />
            </label>
          </div>
        )}
        <label className="form-field">
          <span>Notes (optional)</span>
          <input
            placeholder="Account reference or context"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <div className="modal-actions split-actions">
          {onDelete && (
            <button type="button" className="danger-button" onClick={onDelete}>
              Delete
            </button>
          )}
          <span />
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            Save
          </button>
        </div>
      </form>
    </SimpleModal>
  );
}

function ValuationModal({
  position,
  onClose,
  onSave,
}: {
  position: FinancialPosition;
  onClose: () => void;
  onSave: (date: string, value: number, note: string) => void;
}) {
  const current = latestValuation(position);
  const [value, setValue] = useState(current?.value.toString() ?? "");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number(value);
    if (parsed < 0) return;
    onSave(date, parsed, note.trim());
  };

  return (
    <SimpleModal title={`Update ${position.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="modal-help">
          This adds a new dated value. Previous values remain available for trend
          analysis.
        </p>
        <label className="form-field amount-field">
          <span>New value</span>
          <div>
            <i>₹</i>
            <input
              autoFocus
              required
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
        </label>
        <label className="form-field">
          <span>Value date</span>
          <input
            required
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Note (optional)</span>
          <input
            placeholder="e.g. Month-end balance"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Add valuation
          </button>
        </div>
      </form>
    </SimpleModal>
  );
}

function SimpleModal({
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
            <p className="eyebrow">Financial position</p>
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

function HistoryChart({
  history,
}: {
  history: ReturnType<typeof netWorthHistory>;
}) {
  const values = history.map((item) => item.netWorth);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const points = history
    .map((item, index) => {
      const x = history.length === 1 ? 50 : (index / (history.length - 1)) * 100;
      const y = 90 - ((item.netWorth - min) / range) * 75;
      return `${x},${y}`;
    })
    .join(" ");
  const first = history[0];
  const last = history[history.length - 1];

  return (
    <div className="history-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Net worth trend">
        <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="history-chart-labels">
        <span>
          {formatDate(first.date)}
          <strong>{currency.format(first.netWorth)}</strong>
        </span>
        <span>
          {formatDate(last.date)}
          <strong>{currency.format(last.netWorth)}</strong>
        </span>
      </div>
    </div>
  );
}

function PositionEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-state">
      <i>◇</i>
      <strong>No financial positions yet</strong>
      <p>Add bank balances, investments, property, and outstanding debts.</p>
      <button className="secondary-button" onClick={onAdd}>
        Add asset or debt
      </button>
    </div>
  );
}
