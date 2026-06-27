type DecimalLike = {
  toNumber: () => number;
};

export function toNumber(value: DecimalLike | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : value.toNumber();
}
