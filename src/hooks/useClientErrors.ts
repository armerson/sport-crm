import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase.ts'
import { subscribeToClientErrors, type ClientErrorRecord } from '../services/clientErrors.ts'

export function useClientErrors() {
  const [errors, setErrors] = useState<ClientErrorRecord[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    return subscribeToClientErrors(
      (rows) => { setErrors(rows); setError(null); setLoading(false) },
      (message) => { setError(message); setLoading(false) },
    )
  }, [])

  return { errors, loading, error }
}

