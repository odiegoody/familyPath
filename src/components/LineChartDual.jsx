import { formatRupiah, formatDateShort } from "../utils/format";

// Chart garis sederhana pakai SVG murni (tidak butuh library chart eksternal).
// series: [{ label, color, points: [{ date(ms), value }] }]
export default function LineChartDual({ series, height = 220 }) {
  const width = 600;
  const padding = { top: 16, right: 12, bottom: 28, left: 12 };

  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-outline-variant text-xs text-on-surface-variant">
        Belum ada data untuk ditampilkan
      </div>
    );
  }

  const minDate = Math.min(...allPoints.map((p) => p.date));
  const maxDate = Math.max(...allPoints.map((p) => p.date));
  const minValue = 0;
  const maxValue = Math.max(...allPoints.map((p) => p.value)) * 1.08 || 1;

  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const xScale = (date) =>
    padding.left + (maxDate === minDate ? 0 : ((date - minDate) / (maxDate - minDate)) * innerW);
  const yScale = (value) =>
    padding.top + innerH - ((value - minValue) / (maxValue - minValue || 1)) * innerH;

  function toPath(points) {
    return points
      .slice()
      .sort((a, b) => a.date - b.date)
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.date).toFixed(1)} ${yScale(p.value).toFixed(1)}`)
      .join(" ");
  }

  // Grid horizontal (4 garis) + label nilai
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => minValue + (maxValue - minValue) * f);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ overflow: "visible" }}>
        {gridLines.map((v, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={yScale(v)}
              y2={yScale(v)}
              stroke="currentColor"
              className="text-outline-variant"
              strokeWidth="1"
            />
            <text
              x={padding.left}
              y={yScale(v) - 4}
              fontSize="9"
              className="fill-on-surface-variant"
            >
              {formatRupiah(v, { withSymbol: false })}
            </text>
          </g>
        ))}

        {series.map((s) => (
          <path key={s.label} d={toPath(s.points)} fill="none" stroke={s.color} strokeWidth="2.5" />
        ))}

        {/* Titik terakhir tiap seri */}
        {series.map((s) => {
          const sorted = s.points.slice().sort((a, b) => a.date - b.date);
          const last = sorted[sorted.length - 1];
          if (!last) return null;
          return (
            <circle
              key={`dot-${s.label}`}
              cx={xScale(last.date)}
              cy={yScale(last.value)}
              r="4"
              fill={s.color}
            />
          );
        })}

        {/* Label tanggal awal & akhir */}
        <text x={padding.left} y={height - 6} fontSize="9" className="fill-on-surface-variant">
          {formatDateShort(minDate)}
        </text>
        <text
          x={width - padding.right}
          y={height - 6}
          fontSize="9"
          textAnchor="end"
          className="fill-on-surface-variant"
        >
          {formatDateShort(maxDate)}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
