import { EmptyState, ErrorState, LoadingSpinner } from '../../../components/ui'

export function FinanceLoading({ label = 'Loading financial data' }) {
  return <div className="finance-state"><LoadingSpinner label={label} /></div>
}

export function FinanceError({ message, onRetry }) {
  return <div className="finance-state"><ErrorState message={message} onRetry={onRetry} /></div>
}

export function FinanceEmpty({ title, message, action }) {
  return <EmptyState title={title} message={message} action={action} />
}
