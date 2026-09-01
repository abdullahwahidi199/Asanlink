export default function Input({ label, error, hint, id, className = '', ...props }) {
  const inputId = id || props.name
  const descriptionId = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
  return (
    <div className={`field ${className}`.trim()}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <input
        id={inputId}
        className={error ? 'input input--error' : 'input'}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionId}
        {...props}
      />
      {error ? (
        <span className="field__error" id={descriptionId}>{error}</span>
      ) : hint ? (
        <span className="field__hint" id={descriptionId}>{hint}</span>
      ) : null}
    </div>
  )
}

