import { useId, useState } from 'react'
import { ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react'

import Button from './Button'

export default function FilterToolbar({
  children,
  activeCount = 0,
  columns = 4,
  defaultExpanded = true,
  label = 'Filters',
  onReset,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const generatedId = useId()
  const controlsId = `filter-toolbar-${generatedId.replace(/:/g, '')}`

  return (
    <section className={`filter-toolbar ${expanded ? 'filter-toolbar--expanded' : ''}`} aria-label={`${label} toolbar`}>
      <div className="filter-toolbar__layout">
        <button
          className="filter-toolbar__trigger"
          type="button"
          aria-controls={controlsId}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          <span>{label}</span>
          {activeCount > 0 && <span className="filter-toolbar__count" aria-label={`${activeCount} active filters`}>{activeCount}</span>}
          <ChevronDown className="filter-toolbar__chevron" size={14} aria-hidden="true" />
        </button>

        <div
          id={controlsId}
          className="filter-toolbar__controls"
          style={{ '--filter-toolbar-columns': columns }}
          hidden={!expanded}
        >
          {children}
        </div>

        <Button className="filter-toolbar__reset" variant="ghost" size="small" onClick={onReset}>
          <RotateCcw size={14} aria-hidden="true" />
          Reset
        </Button>
      </div>
    </section>
  )
}
