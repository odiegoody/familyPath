// Perhitungan Future Value (nilai investasi masa depan) untuk fitur Target Investasi.
// Rumus gabungan: pertumbuhan modal awal (lump sum) + setoran rutin bulanan (ordinary annuity).
//   FV = PV * (1+r)^n + PMT * (((1+r)^n - 1) / r)
// r = suku bunga/return per bulan, n = jumlah bulan, PV = modal awal, PMT = setoran bulanan

export function futureValue({ initialAmount = 0, monthlyContribution = 0, annualReturnRate = 0, months = 0 }) {
  const r = annualReturnRate / 100 / 12;
  if (months <= 0) return initialAmount;
  if (r === 0) {
    return initialAmount + monthlyContribution * months;
  }
  const growth = Math.pow(1 + r, months);
  const fvInitial = initialAmount * growth;
  const fvContrib = monthlyContribution * ((growth - 1) / r);
  return fvInitial + fvContrib;
}

export function addMonths(dateMs, months) {
  const d = new Date(dateMs);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

// Hasilkan titik-titik proyeksi bulanan dari startDate sampai `years` ke depan
export function projectionSeries({ startDate, initialAmount, monthlyContribution, annualReturnRate, years }) {
  const totalMonths = Math.round(years * 12);
  const points = [];
  for (let m = 0; m <= totalMonths; m++) {
    points.push({
      date: addMonths(startDate, m),
      value: futureValue({ initialAmount, monthlyContribution, annualReturnRate, months: m }),
    });
  }
  return points;
}
