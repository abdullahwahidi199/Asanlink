export default function EmptyState({ title = 'Nothing here yet', message, action }) {
  return (
    <div className="state-card state-card--empty">
      <div className="state-card__icon" aria-hidden="true">◇</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  )
}

