import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Camera, ImagePlus, Send, UserRound, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { readImage } from '../readImage'

async function request(path, options = {}) {
  const response = await fetch(`/api/profiles/${path}`, {
    credentials: 'same-origin', ...options,
    ...(options.body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body) } : {}),
  })
  const data = await response.json().catch(() => ({ message: response.status === 413 ? 'Размер изображения — не более 2 МБ.' : 'Сервис недоступен. Попробуйте позже.' }))
  if (!response.ok) throw new Error(data.message || 'Не удалось выполнить запрос.')
  return data
}

function Avatar({ url, name, small = false }) {
  return <span className={`profile-avatar ${small ? 'is-small' : ''}`}>
    {url ? <img src={url} alt={`Аватар ${name}`} /> : <UserRound size={small ? 20 : 48} strokeWidth={1} aria-hidden="true" />}
  </span>
}

export default function ProfilePage({ onLogout = () => {} }) {
  const { user, logout } = useAuth()
  const { id } = useParams()
  const profileId = id || user?.id
  const own = Boolean(user && String(user.id) === String(profileId))
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState(undefined)
  const [body, setBody] = useState('')
  const [image, setImage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!profileId) { setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setProfile(null)
    setPosts([])
    setEditing(false)
    setBody('')
    setImage(null)
    setNotice('')
    setConfirmDelete(null)
    Promise.all([
      request(profileId, { signal: controller.signal }),
      request(`${profileId}/wall`, { signal: controller.signal }),
    ]).then(([data, wall]) => {
      if (controller.signal.aborted) return
      setProfile(data.profile)
      setPosts(wall.posts)
      setCursor(wall.nextCursor)
    }).catch(err => { if (!controller.signal.aborted) setError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [profileId, reload])

  async function act(fn) {
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice('')
    try { await fn() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function startEditing() {
    setNickname(profile.nickname)
    setBio(profile.bio)
    setAvatar(undefined)
    setEditing(true)
    setError(null)
    setNotice('')
  }

  async function upload(event, target) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    await act(async () => {
      const data = await readImage(file)
      if (target === 'avatar') setAvatar(data)
      else setImage(data)
    })
  }

  async function save(event) {
    event.preventDefault()
    await act(async () => {
      const result = await request(profileId, { method: 'PATCH', body: { nickname, bio, ...(avatar !== undefined ? { avatar } : {}) } })
      setProfile(result.profile)
      setPosts(current => current.map(post => post.author.id === result.profile.id
        ? { ...post, author: { ...post.author, nickname: result.profile.nickname, avatarURL: result.profile.avatarURL } }
        : post))
      setEditing(false)
      setNotice('Профиль сохранён.')
    })
  }

  async function publish(event) {
    event.preventDefault()
    await act(async () => {
      await request(`${profileId}/wall`, { method: 'POST', body: { body, image } })
      setBody('')
      setImage(null)
      const wall = await request(`${profileId}/wall`)
      setPosts(wall.posts)
      setCursor(wall.nextCursor)
      setNotice('Запись опубликована.')
    })
  }

  return <section className="profile-window" aria-labelledby="profile-title">
    <header className="auth-titlebar"><h2 id="profile-title">USER_PROFILE.exe</h2><span className="profile-window-label">{own ? 'MY_PROFILE' : 'PUBLIC_PROFILE'}</span></header>
    <div className="profile-body">
      <div className="profile-toolbar">
        <span className="profile-window-label">ID: {profileId || 'GUEST'}</span>
        <div className="profile-buttons">
          {profile && <button type="button" onClick={() => act(async () => { await navigator.clipboard.writeText(`${window.location.origin}/profile/${profileId}`); setNotice('Ссылка скопирована.') })} disabled={busy}>[ Ссылка ]</button>}
          {own && <button type="button" disabled={busy} onClick={() => act(async () => { await logout(); onLogout() })}>[ LOG OUT ]</button>}
        </div>
      </div>
      {own && <p className="sr-only">Добро пожаловать, {user.username}.</p>}
      {error && <div role="alert" className="auth-error">{error} {!profile && <button type="button" onClick={() => setReload(value => value + 1)}>[ Повторить ]</button>}</div>}
      {notice && <p role="status" className="profile-notice">{notice}</p>}
      {loading ? <p role="status" className="profile-empty">[ LOADING_PROFILE… ]</p> : !profile ? (
        !user && !id && <p className="auth-notice">Для просмотра своего профиля войдите через [ ENTER ].</p>
      ) : <>
        {editing && own ? <form onSubmit={save} className="profile-edit">
          <div className="profile-edit-avatar">
            <Avatar url={avatar === undefined ? profile.avatarURL : avatar} name={nickname} />
            <label className="profile-upload"><Camera size={14} /> Аватар<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={event => upload(event, 'avatar')} /></label>
            <button type="button" onClick={() => setAvatar(null)} disabled={busy}>Убрать аватар</button>
            <span className="profile-window-label">PNG / JPG / WebP / GIF · до 2 МБ</span>
          </div>
          <div className="profile-edit-fields">
            <label htmlFor="profile-nickname">Ник</label>
            <input id="profile-nickname" value={nickname} onChange={event => setNickname(event.target.value)} required maxLength={40} disabled={busy} />
            <label htmlFor="profile-bio">Био <span>{bio.length}/1000</span></label>
            <textarea id="profile-bio" value={bio} onChange={event => setBio(event.target.value)} maxLength={1000} rows={4} disabled={busy} />
            <div className="profile-buttons"><button type="submit" disabled={busy}>[ {busy ? 'Сохранение…' : 'Сохранить'} ]</button><button type="button" disabled={busy} onClick={() => { setEditing(false); setError(null) }}>[ Отмена ]</button></div>
          </div>
        </form> : <div className="profile-summary">
          <Avatar url={profile.avatarURL} name={profile.nickname} />
          <div className="profile-info"><span className="profile-window-label">NICKNAME</span><h3>{profile.nickname}</h3><p className="profile-bio">{profile.bio || 'Пока ничего о себе не рассказал.'}</p>
            {own && <div className="profile-buttons"><button type="button" disabled={busy} onClick={startEditing}>[ Редактировать профиль ]</button></div>}
          </div>
        </div>}
        <section className="profile-wall" aria-labelledby="wall-title">
          <div className="wall-title"><h3 id="wall-title">MESSAGE_WALL.sys</h3><span>PUBLIC CHANNEL</span></div>
          {user ? <form className="wall-compose" onSubmit={publish}>
            <label className="sr-only" htmlFor="wall-message">Сообщение на стене</label>
            <textarea id="wall-message" placeholder="Оставить сообщение на стене…" maxLength={2000} value={body} onChange={event => setBody(event.target.value)} rows={3} disabled={busy} />
            {image && <div className="wall-attachment"><img src={image} alt="Вложение к новой записи" /><button type="button" aria-label="Убрать вложение" disabled={busy} onClick={() => setImage(null)}><X size={16} /></button></div>}
            <div className="wall-compose-footer"><label className="profile-upload"><ImagePlus size={15} /> Картинка / GIF<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={event => upload(event, 'wall')} /></label><span>{body.length}/2000</span><button type="submit" disabled={busy || (!body.trim() && !image)}><Send size={13} /> {busy ? 'Отправка…' : 'Отправить'}</button></div>
          </form> : <p className="wall-guest">Войдите через [ ENTER ], чтобы оставить запись на стене.</p>}
          <div className="wall-posts">
            {!posts.length && <p className="profile-empty">[ NO_MESSAGES ]<br /><span>Здесь пока тихо. Оставьте первую запись.</span></p>}
            {posts.map(post => <article className="wall-post" key={post.id}>
              <Link to={`/profile/${post.author.id}`} className="wall-author-avatar"><Avatar small url={post.author.avatarURL} name={post.author.nickname} /></Link>
              <div className="wall-post-content"><div className="wall-post-meta"><Link to={`/profile/${post.author.id}`}>{post.author.nickname}</Link><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</time>
                {user && (own || user.id === post.author.id) && <div className="wall-delete">{confirmDelete === post.id ? <><button type="button" disabled={busy} onClick={() => act(async () => { await request(`${profileId}/wall/${post.id}`, { method: 'DELETE' }); setPosts(current => current.filter(item => item.id !== post.id)); setConfirmDelete(null) })}>Удалить?</button><button type="button" onClick={() => setConfirmDelete(null)}>Отмена</button></> : <button type="button" aria-label="Удалить запись" disabled={busy} onClick={() => setConfirmDelete(post.id)}><X size={13} /></button>}</div>}
              </div>{post.body && <p className="wall-post-text">{post.body}</p>}{post.imageURL && <a href={post.imageURL} target="_blank" rel="noreferrer"><img className="wall-post-image" src={post.imageURL} alt="Изображение в записи на стене" loading="lazy" /></a>}</div>
            </article>)}
          </div>
          {cursor && <div className="profile-buttons wall-more"><button type="button" disabled={busy} onClick={() => act(async () => { const wall = await request(`${profileId}/wall?before=${cursor}`); setPosts(current => [...current, ...wall.posts]); setCursor(wall.nextCursor) })}>[ Показать ещё ]</button></div>}
        </section>
      </>}
      <div className="auth-divider" /><p className="auth-status">PROFILE // {own ? 'OWNER' : 'VISITOR'} · {user ? 'AUTHORIZED' : 'READ ONLY'}</p>
    </div>
  </section>
}
