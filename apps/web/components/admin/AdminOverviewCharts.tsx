"use client";

import { useMemo, useRef, useState } from "react";

type TrendPoint = { date: string; revenue: number; orders: number };

const dateLabel = (value: string) => new Date(value).toLocaleDateString("en-BD", { day: "numeric", month: "short" });

function niceMax(value: number) {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const residual = value / magnitude;
  const step = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  return step * magnitude;
}

function compactMoney(value: number) {
  if (value >= 1_000_000) return `৳${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `৳${(value / 1_000).toFixed(1)}K`;
  return `৳${Math.round(value)}`;
}

const WIDTH = 1000;
const HEIGHT = 300;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 56 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

export function SalesTrendChart({
  points,
  formatValue
}: {
  points: TrendPoint[];
  formatValue: (value: number) => string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const maxValue = useMemo(() => niceMax(Math.max(1, ...points.map((point) => point.revenue))), [points]);
  const n = points.length;

  const coords = useMemo(
    () =>
      points.map((point, index) => {
        const x = n > 1 ? MARGIN.left + (index / (n - 1)) * PLOT_WIDTH : MARGIN.left + PLOT_WIDTH / 2;
        const y = MARGIN.top + PLOT_HEIGHT - (point.revenue / maxValue) * PLOT_HEIGHT;
        return { x, y, point };
      }),
    [points, maxValue, n]
  );

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath =
    coords.length > 0
      ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${MARGIN.top + PLOT_HEIGHT} L${coords[0].x.toFixed(1)},${MARGIN.top + PLOT_HEIGHT} Z`
      : "";

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  const updateFromClientX = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * WIDTH;
    const ratio = Math.min(1, Math.max(0, (relX - MARGIN.left) / PLOT_WIDTH));
    const index = Math.round(ratio * (n - 1));
    setHovered(Math.min(n - 1, Math.max(0, index)));
  };

  const active = hovered !== null ? coords[hovered] : null;
  const tooltipLeftPct = active ? (active.x / WIDTH) * 100 : 0;
  const tooltipAlign = tooltipLeftPct < 12 ? "left" : tooltipLeftPct > 88 ? "right" : "center";

  return (
    <div className="admin-trend-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Net sales trend"
        onPointerMove={(event) => updateFromClientX(event.clientX)}
        onPointerLeave={() => setHovered(null)}
        onFocus={() => setHovered(n - 1)}
        onBlur={() => setHovered(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setHovered((current) => Math.max(0, (current ?? n - 1) - 1));
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            setHovered((current) => Math.min(n - 1, (current ?? 0) + 1));
          } else if (event.key === "Escape") {
            setHovered(null);
          }
        }}
        tabIndex={0}
      >
        {gridSteps.map((step) => {
          const y = MARGIN.top + PLOT_HEIGHT - step * PLOT_HEIGHT;
          return (
            <g key={step}>
              <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y} y2={y} className="admin-trend-grid" />
              <text x={MARGIN.left - 8} y={y} className="admin-trend-tick" textAnchor="end" dominantBaseline="middle">
                {compactMoney(maxValue * step)}
              </text>
            </g>
          );
        })}

        {areaPath ? <path d={areaPath} className="admin-trend-area" /> : null}
        {linePath ? <path d={linePath} className="admin-trend-line" /> : null}

        {coords.length > 0
          ? (n <= 8 ? coords : coords.filter((_, i) => i % Math.ceil(n / 5) === 0 || i === n - 1)).map((c) => (
              <text
                key={c.point.date}
                x={Math.min(WIDTH - MARGIN.right, Math.max(MARGIN.left, c.x))}
                y={HEIGHT - 8}
                className="admin-trend-tick"
                textAnchor="middle"
              >
                {dateLabel(c.point.date)}
              </text>
            ))
          : null}

        {active ? (
          <>
            <line
              x1={active.x}
              x2={active.x}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_HEIGHT}
              className="admin-trend-crosshair"
            />
            <circle cx={active.x} cy={active.y} r={5} className="admin-trend-dot" />
          </>
        ) : coords.length > 0 ? (
          <circle
            cx={coords[coords.length - 1].x}
            cy={coords[coords.length - 1].y}
            r={5}
            className="admin-trend-dot"
          />
        ) : null}
      </svg>

      {active ? (
        <div
          className={`admin-trend-tooltip align-${tooltipAlign}`}
          style={{ left: `${tooltipLeftPct}%`, top: `${(active.y / HEIGHT) * 100}%` }}
        >
          <strong>{formatValue(active.point.revenue)}</strong>
          <span>{active.point.orders} order{active.point.orders === 1 ? "" : "s"}</span>
          <small>{dateLabel(active.point.date)}</small>
        </div>
      ) : null}

      <span className="sr-only" aria-live="polite">
        {active
          ? `${dateLabel(active.point.date)}: ${formatValue(active.point.revenue)}, ${active.point.orders} orders`
          : ""}
      </span>
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const width = 72;
  const height = 26;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = Math.max(1, max - min);
  const n = values.length;

  if (n < 2) return null;

  const coords = values.map((value, index) => ({
    x: (index / (n - 1)) * width,
    y: height - ((value - min) / range) * height
  }));

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];

  return (
    <svg className="admin-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} />
      <circle cx={last.x} cy={last.y} r={2.4} />
    </svg>
  );
}

export function CategoryBarChart({
  items,
  formatValue = compactMoney
}: {
  items: Array<{ name: string; units: number; revenue: number }>;
  formatValue?: (value: number) => string;
}) {
  const ranked = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.revenue - a.revenue);
    if (sorted.length <= 6) return sorted;
    const head = sorted.slice(0, 5);
    const tail = sorted.slice(5);
    const folded = {
      name: "Other categories",
      units: tail.reduce((sum, item) => sum + item.units, 0),
      revenue: tail.reduce((sum, item) => sum + item.revenue, 0)
    };
    return [...head, folded];
  }, [items]);

  const max = Math.max(1, ...ranked.map((item) => item.revenue));

  if (!ranked.length) {
    return <p className="admin-muted">No category sales recorded in this period yet.</p>;
  }

  return (
    <div className="admin-category-list">
      {ranked.map((item) => (
        <div className="admin-category-row" key={item.name}>
          <span className="admin-category-name">{item.name}</span>
          <div className="admin-category-track">
            <span style={{ width: `${Math.max(4, (item.revenue / max) * 100)}%` }} />
          </div>
          <div className="admin-category-figures">
            <strong>{formatValue(item.revenue)}</strong>
            <small>{item.units} units</small>
          </div>
        </div>
      ))}
    </div>
  );
}
