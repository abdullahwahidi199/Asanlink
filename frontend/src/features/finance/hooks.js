import { useCallback, useEffect, useState } from 'react'

import financeService from '../../services/financeService'
import { getApiError } from '../../services/errorService'

export function useFinanceLookups() {
  const [members, setMembers] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [memberRows, categoryRows] = await Promise.all([financeService.members(), financeService.categories()])
      setMembers(memberRows); setCategories(categoryRows)
    } catch (requestError) { setError(getApiError(requestError).message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  return { members, categories, loading, error, retry: load }
}
