export default function PageHeader({ eyebrow, title, description, actions, variant = 'default' }) {
  return (
    <div className={`page-header page-header--${variant}`}>
      <div>
        {eyebrow && <span className="page-header__eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  )
}
