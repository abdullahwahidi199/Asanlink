import Button from './Button'

export default function Pagination({ page, total, pageSize = 10, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <nav className="pagination" aria-label="Pagination">
      <Button variant="secondary" size="small" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      <span>Page <strong>{page}</strong> of <strong>{pages}</strong></span>
      <Button variant="secondary" size="small" onClick={() => onChange(page + 1)} disabled={page >= pages}>
        Next
      </Button>
    </nav>
  )
}

