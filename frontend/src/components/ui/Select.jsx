export default function Select({ label, error, hint, id, children, className = '', ...props }) {
  const selectId = id || props.name
  const descriptionId = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined
  return (
    <div className={`field ${className}`.trim()}>
      {label && <label htmlFor={selectId}>{label}</label>}
      <select
        id={selectId}
        className={error ? 'select input--error' : 'select'}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionId}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <span className="field__error" id={descriptionId}>{error}</span>
      ) : hint ? (
        <span className="field__hint" id={descriptionId}>{hint}</span>
      ) : null}
    </div>
  )
}

