export function computeLiveWeight(product, weights) {
  if (!product || !weights) return 0;
  const from = Number(product.from) || 0;
  const to = Number(product.to) || 0;
  // consider inclusive
  const related = weights.filter(
    (w) => Number(w.load_cell_id) >= from && Number(w.load_cell_id) <= to
  );
  const total = related.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  return total;
}

export function computeStatusFromCount(count, warning = 0, alarm = 0) {
  if (count <= 0) return 3; // out of stock
  if (count <= Number(alarm)) return 2; // alarm
  if (count <= Number(warning)) return 1; // warning
  return 0; // OK
}

export const STATUS_LABEL = {
  0: "OK",
  1: "Warning",
  2: "Alarm",
  3: "Out",
};

export const STATUS_COLOR = {
  0: "#1e7e34", // green
  1: "#f0ad4e", // orange
  2: "#d6332a", // red
  3: "#6c757d", // gray
};
