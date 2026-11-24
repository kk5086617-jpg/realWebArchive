import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const AuthContext = createContext(null)

async function authRequest(path, body) {
  const response = await fetch(`/api/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Не удалось выполнить запрос.')
  return data
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState(null)
  const sessionRevision = useRef(0)

  const refresh = useCallback(async () => {
    const revision = ++sessionRevision.current
    try {
      const data = await authRequest('me')
      if (revision !== sessionRevision.current) return
      setUser(data.user)
      setSessionError(null)
    } catch {
      if (revision === sessionRevision.current) setSessionError('Не удалось проверить сессию. Проверьте соединение и повторите попытку.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    // Recheck when returning from another tab where the user may have logged out.
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])

  async function authenticate(mode, credentials) {
    const data = await authRequest(mode, credentials)
    sessionRevision.current++
    setUser(data.user)
    setSessionError(null)
  }

  async function logout() {
    await authRequest('logout', {})
    sessionRevision.current++
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, sessionError, refresh, authenticate, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
