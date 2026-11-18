import { useMemo } from "react";

/**
 * Simple SVG sparkline/area chart for trend visualization
 * No external dependencies, lightweight
 */
export default function MiniChart({
  data,
  color = "#2f8f4e",
  height = 60,
  width = "100%",
  type = "line", // "line" | "area" | "bar"
  showPoints = true,
}) {
  if (!data?.length) {
    return (
      <svg viewBox="0 0 100 100" style={{ width, height }} className="text-on-surface-variant/30">
        <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4,4" />
      </svg>
    );
  }

  const { points, max, min, range } = useMemo(() => {
    const values = data.map(d => d.value ?? d.expense ?? d.total ?? d.spent ?? d.net ?? 0);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    const points = data.map((d, i) => {
      const val = d.value ?? d.expense ?? d.total ?? d.spent ?? d.net ?? 0;
      const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
      const y = 100 - ((val - min) / range) * 80; // 80% height, 10% margin top/bottom
      return { x, y, val };
    });

    return { points, max, min, range };
  }, [data]);

  const pointsString = points.map(p => `${p.x}% ${p.y}%`).join(", ");

  const lineColor = color;
  const areaColor = `${color}20`; // 12% opacity

  return (
    <svg
      viewBox="0 0 100 100"
      style={{ width, height }}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Chart showing ${data.length} data points, range ${min} to ${max}`}
    >
      {/* Grid lines */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Area fill */}
      {type === "area" && (
        <path
          d={`M ${points[0].x}% 100 L ${pointsString} L ${points[points.length - 1].x}% 100 Z`}
          fill={areaColor}
        />
      )}

      {/* Line */}
      {type !== "bar" && (
        <polyline
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsString}
        />
      )}

      {/* Bars */}
      {type === "bar" && (
        <g>
          {points.map((p, i) => (
            <rect
              key={i}
              x={`${Math.max(0, p.x - 100 / data.length / 2)}%`}
              y={`${p.y}%`}
              width={`${100 / data.length * 0.6}%`}
              height={`${100 - p.y}%`}
              fill={lineColor}
              rx="1"
            />
          ))}
        </g>
      )}

      {/* Points */}
      {showPoints && type !== "bar" && (
        <g>
          {points.map((p, i) => (
            <circle
              key={i}
              cx={`${p.x}%`}
              cy={`${p.y}%`}
              r="3"
              fill={lineColor}
              stroke="var(--surface)"
              strokeWidth="2"
            />
          ))}
        </g>
      )}

      {/* Last value indicator */}
      {points.length > 1 && (
        <g>
          <circle
            cx={`${points[points.length - 1].x}%`}
            cy={`${points[points.length - 1].y}%`}
            r="5"
            fill="var(--surface)"
            stroke={lineColor}
            strokeWidth="2"
          />
          <circle
            cx={`${points[points.length - 1].x}%`}
            cy={`${points[points.length - 1].y}%`}
            r="3"
            fill={lineColor}
          />
        </g>
      )}

    </svg>
  );
}