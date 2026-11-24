import React, { useEffect, useRef, useState } from 'react'
import { LockKeyhole, Terminal } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

export default function AuthWindow({ onClose, onSuccess }) {
  const { authenticate, sessionError, refresh } = useAuth()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const [help, setHelp] = useState(false)
  const loginRef = useRef(null)
  const registering = mode === 'register'

  useEffect(() => { loginRef.current?.focus() }, [mode])

  function switchMode() {
    setMode(registering ? 'login' : 'register')
    setPassword('')
    setConfirmation('')
    setError(null)
    setHelp(false)
  }

  async function submit(event) {
    event.preventDefault()
    if (pending) return
    setError(null)
    if (registering && password !== confirmation) {
      setError('Пароли не совпадают.')
      return
    }
    setPending(true)
    try {
      await authenticate(mode, { username, password })
      setPassword('')
      setConfirmation('')
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="auth-window" aria-labelledby="auth-title" onKeyDown={event => {
      if (event.key === 'Escape' && !pending) onClose()
    }}>
      <header className="auth-titlebar">
        <h2 id="auth-title"><Terminal size={12} aria-hidden="true" />{registering ? 'SYSTEM_REGISTER.exe' : 'SYSTEM_LOGIN.exe'}</h2>
        <div className="auth-window-controls">
          <button type="button" aria-label="Справка об авторизации" aria-expanded={help} onClick={() => setHelp(value => !value)}>?</button>
          <button type="button" aria-label="Закрыть окно авторизации" disabled={pending} onClick={onClose}>×</button>
        </div>
      </header>
      <div className="auth-body">
        {sessionError && <div className="auth-notice" role="alert">{sessionError} <button type="button" onClick={refresh}>Повторить</button></div>}
        <form onSubmit={submit}>
          <div className="auth-fields">
            <div className="auth-lock" aria-hidden="true"><LockKeyhole size={30} strokeWidth={1.4} /></div>
            <div className="auth-inputs">
              <label htmlFor="auth-login">Login:</label>
              <input ref={loginRef} id="auth-login" name="username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" placeholder="<ваш логин>" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_.\-]+" disabled={pending} aria-describedby={registering ? 'auth-rules' : undefined} />
              <label htmlFor="auth-password">Password:</label>
              <input id="auth-password" name="password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 8 : 1} maxLength={128} disabled={pending} />
              {registering && <>
                <label htmlFor="auth-confirm">Repeat:</label>
                <input id="auth-confirm" name="confirmation" type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={128} disabled={pending} />
              </>}
            </div>
          </div>
          {registering && <p className="auth-hint" id="auth-rules">Логин: 3–32 символа, латинские буквы, цифры, . _ -<br />Пароль: от 8 до 128 символов.</p>}
          <div className="auth-actions">
            <button type="submit" disabled={pending} className="auth-primary">{pending ? 'Wait…' : 'OK'}</button>
            <button type="button" disabled={pending} onClick={switchMode}>{registering ? 'Back to login' : 'Registration'}</button>
            {!registering && <button type="button" onClick={() => setHelp(value => !value)} aria-expanded={help}>Forgot password?</button>}
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {help && <div className="auth-notice">Для первого входа нажмите Registration и создайте аккаунт. Восстановление пароля пока недоступно: электронная почта к аккаунту не привязана.</div>}
        </form>
        <div className="auth-divider" />
        <p className="auth-status" role="status">{pending ? 'Authenticating…' : 'Connected to: LOCAL_NET // Secure session'}</p>
      </div>
    </section>
  )
}
