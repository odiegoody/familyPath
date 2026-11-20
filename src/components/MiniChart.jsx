import { useMemo, useState } from "react";

/**
 * Simple SVG sparkline/area chart for trend visualization
 * No external dependencies, lightweight
 */
export default function MiniChart({
  data,
  color = "#2f8f4e",
  height = 80,
  width = "100%",
  type = "line", // "line" | "area" | "bar"
  showPoints = true,
  showLabels = true,
  animate = true,
}) {
  if (!data?.length) {
    return (
      <svg viewBox="0 0 100 100" style={{ width, height }} className="text-on-surface-variant/30" role="img" aria-label="Tidak ada data">
        <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4,4" />
      </svg>
    );
  }

  const { points, max, min, range, yStep, yLabels } = useMemo(() => {
    const values = data.map(d => d.value ?? d.expense ?? d.total ?? d.spent ?? d.net ?? 0);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    // Calculate nice y-axis steps
    const rawStep = range / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    let niceStep;
    if (normalized < 1.5) niceStep = 1;
    else if (normalized < 3) niceStep = 2;
    else if (normalized < 7) niceStep = 5;
    else niceStep = 10;
    const yStep = niceStep * magnitude;

    // Generate y-axis labels
    const yLabels = [];
    const start = Math.ceil(max / yStep) * yStep;
    for (let i = 0; i <= 4; i++) {
      const val = start - i * yStep;
      if (val >= min - yStep * 0.5) yLabels.push(val);
    }

    const points = data.map((d, i) => {
      const val = d.value ?? d.expense ?? d.total ?? d.spent ?? d.net ?? 0;
      const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
      const y = 100 - ((val - min) / range) * 80; // 80% height, 10% margin top/bottom
      return { x, y, val, label: d.monthLabel || d.label || `Bulan ${i + 1}` };
    });

    return { points, max, min, range, yStep, yLabels };
  }, [data]);

  const pointsString = points.map(p => `${p.x}% ${p.y}%`).join(", ");
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const lineColor = color;
  const areaColor = `${color}33`; // 20% opacity
  const gridColor = "currentColor";

  return (
    <div style={{ width, height }} className="relative">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%" }}
        role="img"
        aria-label={`Chart showing ${data.length} data points, range ${min} to ${max}`}
        onMouseMove={(e) => {
          if (!animate) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const idx = Math.round((x / 100) * (points.length - 1));
          setHoveredIndex(Math.max(0, Math.min(points.length - 1, idx)));
        }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M 25 0 L 0 0 0 25" fill="none" stroke={gridColor} strokeWidth="0.3" opacity="0.08"/>
          </pattern>
          {/* Gradient for area */}
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Background grid */}
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Horizontal grid lines with labels */}
        {showLabels && yLabels.map((val, i) => (
          <g key={i}>
            <line
              x1="0" y1={`${100 - ((val - min) / range) * 80}%`}
              x2="100%" y2={`${100 - ((val - min) / range) * 80}%`}
              stroke={gridColor} strokeWidth="0.3" opacity="0.15"
            />
            <text
              x="1" y={`${100 - ((val - min) / range) * 80}%`}
              dy="-2" fontSize="6" fill="currentColor" opacity="0.5" fontFamily="monospace"
            >
              {val >= 1e6 ? (val/1e6).toFixed(1)+'M' : val >= 1e3 ? (val/1e3).toFixed(0)+'K' : val}
            </text>
          </g>
        ))}

        {/* Area fill */}
        {type === "area" && (
          <path
            d={`M ${points[0].x}% 100 L ${pointsString} L ${points[points.length - 1].x}% 100 Z`}
            fill="url(#areaGradient)"
          />
        )}

        {/* Line */}
        {type !== "bar" && (
          <polyline
            fill="none"
            stroke={lineColor}
            strokeWidth={animate ? 2.5 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsString}
            filter="drop-shadow(0 1px 2px rgba(0,0,0,0.1))"
            style={{
              strokeDasharray: animate ? "1000" : "none",
              strokeDashoffset: animate ? "1000" : "0",
              animation: animate ? "draw 0.8s ease-out forwards" : "none",
            }}
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
                width={`${100 / data.length * 0.55}%`}
                height={`${100 - p.y}%`}
                fill={lineColor}
                rx="1.5"
                opacity={hoveredIndex === i ? 1 : 0.7}
                style={{ transition: "opacity 0.15s" }}
              />
            ))}
          </g>
        )}

        {/* Points */}
        {showPoints && type !== "bar" && (
          <g>
            {points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={`${p.x}%`}
                  cy={`${p.y}%`}
                  r={hoveredIndex === i ? 5 : 3.5}
                  fill={lineColor}
                  stroke="var(--surface)"
                  strokeWidth={hoveredIndex === i ? 3 : 2}
                  opacity={hoveredIndex === i || hoveredIndex === null ? 1 : 0.4}
                  style={{ transition: "all 0.15s" }}
                />
                {hoveredIndex === i && (
                  <>
                    <circle
                      cx={`${p.x}%`}
                      cy={`${p.y}%`}
                      r={7}
                      fill="transparent"
                      stroke={lineColor}
                      strokeWidth={1.5}
                      strokeDasharray="4,2"
                    />
                    {/* Tooltip */}
                    <foreignObject
                      x={`${Math.max(5, Math.min(85, p.x - 15))}%`}
                      y={`${Math.max(5, p.y - 25)}%`}
                      width="30%"
                      height="20px"
                      style={{ pointerEvents: "none" }}
                    >
                      <div style={{
                        background: "var(--on-surface)",
                        color: "var(--surface)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                        transform: "translateX(-50%)",
                        fontFamily: "inherit",
                      }}>
                        {p.val >= 1e6 ? (p.val/1e6).toFixed(1)+'M' : p.val >= 1e3 ? (p.val/1e3).toFixed(0)+'K' : p.val}
                      </div>
                    </foreignObject>
                  </>
                )}
              </g>
            ))}
          </g>
        )}

        {/* Last value indicator */}
        {points.length > 1 && (
          <g>
            <circle
              cx={`${points[points.length - 1].x}%`}
              cy={`${points[points.length - 1].y}%`}
              r="6"
              fill="var(--surface)"
              stroke={lineColor}
              strokeWidth="2.5"
            />
            <circle
              cx={`${points[points.length - 1].x}%`}
              cy={`${points[points.length - 1].y}%`}
              r="3.5"
              fill={lineColor}
            />
          </g>
        )}

        <style>{`
          @keyframes draw {
            to { stroke-dashoffset: 0; }
          }
        `}</style>
      </svg>

      {/* X-axis labels */}
      {showLabels && points.length > 1 && (
        <div className="flex justify-between px-1 mt-1 text-[9px] text-on-surface-variant font-mono" style={{ fontFamily: 'inherit' }}>
          {points.map((p, i) => (
            <span key={i} style={{
              position: 'absolute',
              left: `${p.x}%`,
              transform: 'translateX(-50%)',
              opacity: points.length > 6 && i % 2 === 1 ? 0.5 : 1
            }}>
              {p.label?.slice(0, 3) || `B${i+1}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}