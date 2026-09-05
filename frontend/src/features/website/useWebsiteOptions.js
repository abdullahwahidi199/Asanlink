import { useEffect, useMemo, useState } from 'react'

import websiteService from '../../services/websiteService'

export default function useWebsiteOptions(fields) {
  const [options, setOptions] = useState({})
  const resources = useMemo(
    () => [...new Set(fields.map((field) => field.optionResource).filter(Boolean))],
    [fields],
  )

  useEffect(() => {
    let active = true
    if (!resources.length) {
      return () => { active = false }
    }
    Promise.all(resources.map(async (resource) => [resource, await websiteService.list(resource, { ordering: 'display_order,name' })]))
      .then((entries) => { if (active) setOptions(Object.fromEntries(entries)) })
      .catch(() => { if (active) setOptions({}) })
    return () => { active = false }
  }, [resources])

  return options
}
