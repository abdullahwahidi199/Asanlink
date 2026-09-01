export default function Dropdown({ label, children, align = 'right' }) {
  return (
    <details className={`dropdown dropdown--${align}`}>
      <summary>{label}</summary>
      <div className="dropdown__menu">{children}</div>
    </details>
  )
}

