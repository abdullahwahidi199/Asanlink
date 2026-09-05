import { currencies, formatMoney } from '../utils'

export default function MoneyStack({ totals = {}, compact = false, signed = false }) {
  return (
    <span className={`money-stack ${compact ? 'money-stack--compact' : ''}`}>
      {currencies.map((currency) => {
        const amount = Number(totals?.[currency] || 0)
        const prefix = signed && amount > 0 ? '+' : ''
        return <strong key={currency} className={amount < 0 ? 'money--negative' : amount > 0 && signed ? 'money--positive' : ''}>{prefix}{formatMoney(amount, currency)}</strong>
      })}
    </span>
  )
}
