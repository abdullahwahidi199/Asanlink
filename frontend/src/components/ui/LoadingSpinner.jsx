export default function LoadingSpinner({ label = 'Loading', size = 'medium' }) {
  return (
    <span className={`loading loading--${size}`} role="status">
      <span className="loading__spinner" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

