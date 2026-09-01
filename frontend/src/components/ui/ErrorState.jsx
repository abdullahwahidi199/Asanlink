import Button from './Button'

export default function ErrorState({ title = 'Unable to load this page', message, onRetry }) {
  return (
    <div className="state-card state-card--error" role="alert">
      <div className="state-card__icon" aria-hidden="true">!</div>
      <h3>{title}</h3>
      <p>{message || 'Please try again.'}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

