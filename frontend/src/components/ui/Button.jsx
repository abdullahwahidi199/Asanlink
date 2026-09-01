export default function Button({
  children,
  variant = 'primary',
  size = 'medium',
  loading = false,
  type = 'button',
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      type={type}
      className={`button button--${variant} button--${size} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="button__spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}

