import { useState } from 'react'

import Button from './Button'

export default function SearchInput({ value = '', onSearch, placeholder = 'Search…', label = 'Search' }) {
  const [query, setQuery] = useState(value)

  const submit = (event) => {
    event.preventDefault()
    onSearch(query.trim())
  }

  return (
    <form className="search" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor="page-search">{label}</label>
      <input
        id="page-search"
        className="input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
      />
      <Button type="submit" variant="secondary">Search</Button>
    </form>
  )
}
