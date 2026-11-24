import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { communityRequest } from '../communityApi'

export default function GameRating({ gameId, onChange }) {
  const { user } = useAuth() || {}
  const [rating, setRating] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const endpoint = `/api/games/${gameId}/rating`
  useEffect(() => {
    const controller = new AbortController()
    setRating(null); setError(null); setNotice('')
    communityRequest(endpoint, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setRating(data); onChange(data.average) }
    }).catch(err => { if (!controller.signal.aborted) setError(err.message) })
    return () => controller.abort()
  }, [endpoint, user?.id, onChange, retry])
  async function vote(value) {
    if (busy) return
    setBusy(true); setError(null); setNotice('')
    try {
      const data = await communityRequest(endpoint, { method: 'PUT', body: { value } })
      setRating(data); onChange(data.average); setNotice('Оценка сохранена.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <section className="game-rating" aria-label="Оценка игры">
    <div><h2>RATE_GAME.sys</h2><p>{rating ? rating.count ? `${rating.average} / 5 · Голосов: ${rating.count}` : 'Пока без оценок' : 'Загрузка оценки…'}</p></div>
    <div className="rating-controls"><div className="rating-stars" role="group" aria-label="Выберите оценку от 1 до 5">{[1,2,3,4,5].map(value => <button type="button" key={value} disabled={!user || busy || !rating} aria-label={`Оценить на ${value}`} aria-pressed={rating?.mine === value} className={value <= (rating?.mine || 0) ? 'is-selected' : ''} onClick={() => vote(value)}>★</button>)}</div>
    <p>{user ? rating?.mine ? `Ваша оценка: ${rating.mine} / 5. Можно изменить.` : 'Поставьте свою оценку.' : <Link to="/?login=1">Войдите, чтобы оценить игру.</Link>}</p></div>
    {error && <p className="auth-error" role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>[ Повторить ]</button></p>}
    {notice && <p className="profile-notice" role="status">{notice}</p>}
  </section>
}
