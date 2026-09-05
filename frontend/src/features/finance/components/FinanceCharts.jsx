import { formatMoney } from '../utils'

export function SpendingBars({ data = [], currency = 'AFN' }) {
  const rows = data.slice(-8)
  const max = Math.max(...rows.map((row) => Number(row[currency] || 0)), 1)
  if (!rows.some((row) => Number(row[currency]))) return <div className="chart-empty">No recorded spending for {currency} in this period.</div>
  return (
    <div className="spending-chart" role="img" aria-label={`Monthly spending in ${currency}`}>
      {rows.map((row) => {
        const amount = Number(row[currency] || 0)
        return <div className="spending-chart__item" key={row.month} title={`${row.month}: ${formatMoney(amount, currency)}`}><div className="spending-chart__track"><span style={{ height: `${Math.max((amount / max) * 100, amount ? 5 : 0)}%` }} /></div><small>{new Date(`${row.month}-02`).toLocaleDateString(undefined, { month: 'short' })}</small></div>
      })}
    </div>
  )
}

export function CategoryBars({ data = [], currency = 'AFN' }) {
  const rows = data.map((item) => ({ ...item, amount: Number(item.totals?.[currency] || item.amount || 0) })).filter((item) => item.amount).slice(0, 7)
  const max = Math.max(...rows.map((row) => row.amount), 1)
  if (!rows.length) return <div className="chart-empty">No category spending for {currency}.</div>
  return <div className="category-chart">{rows.map((row) => <div className="category-chart__row" key={row.id || row.label}><div><span>{row.name || row.label}</span><strong>{formatMoney(row.amount, currency)}</strong></div><div className="category-chart__track"><span style={{ width: `${(row.amount / max) * 100}%`, background: row.color || 'var(--primary)' }} /></div></div>)}</div>
}

export function TrendLine({ data = [], currency = 'AFN' }) {
  const rows = data.slice(-12)
  const width = 600; const height = 180; const inset = 16
  const values = rows.map((row) => Number(row[currency] || 0))
  const max = Math.max(...values, 1)
  const points = values.map((value, index) => {
    const x = rows.length === 1 ? width / 2 : inset + (index * (width - inset * 2)) / (rows.length - 1)
    const y = height - inset - (value / max) * (height - inset * 2)
    return `${x},${y}`
  }).join(' ')
  if (!values.some(Boolean)) return <div className="chart-empty">No spending trend is available for {currency}.</div>
  return <div className="trend-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Spending trend in ${currency}`} preserveAspectRatio="none"><defs><linearGradient id={`trend-${currency}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity=".22" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs><polygon points={`${points} ${width - inset},${height - inset} ${inset},${height - inset}`} fill={`url(#trend-${currency})`} /><polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="3" vectorEffect="non-scaling-stroke" />{values.map((value, index) => { const [x, y] = points.split(' ')[index].split(','); return <circle key={`${rows[index].month}-${currency}`} cx={x} cy={y} r="4" fill="var(--surface)" stroke="var(--primary)" strokeWidth="3"><title>{rows[index].month}: {formatMoney(value, currency)}</title></circle> })}</svg><div className="trend-chart__labels">{rows.map((row) => <span key={row.month}>{row.month.slice(5)}</span>)}</div></div>
}
