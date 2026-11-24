import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ImagePlus, Send, UserRound, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { communityRequest } from '../communityApi'
import { readImage } from '../readImage'

export default function Discussion({ endpoint, chat = false }) {
  const { user } = useAuth() || {}
  const [posts, setPosts] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [body, setBody] = useState('')
  const [image, setImage] = useState(null)
  const [reading, setReading] = useState(false)
  const followBottom = useRef(true)
  const [sending, setSending] = useState(false)
  const [more, setMore] = useState(false)
  const [connected, setConnected] = useState(false)
  const [retry, setRetry] = useState(0)
  const viewport = useRef(null)
  const latest = useRef(0)
  const scroll = useRef('bottom')

  function merge(incoming) {
    if (!incoming?.length) return
    latest.current = Math.max(latest.current, ...incoming.map(post => post.id))
    setPosts(current => [...new Map([...current, ...incoming].map(post => [post.id, post])).values()].sort((a, b) => b.id - a.id))
  }

  useLayoutEffect(() => {
    if (!chat || !viewport.current) return
    const box = viewport.current
    if (scroll.current === 'bottom') box.scrollTop = box.scrollHeight
    else if (scroll.current && typeof scroll.current === 'object') box.scrollTop = box.scrollHeight - scroll.current.height + scroll.current.top
    scroll.current = null
  }, [posts, chat])

  useEffect(() => {
    const abort = new AbortController()
    let socket, timer, stopped = false, attempt = 0
    latest.current = 0
    setPosts([]); setCursor(null); setLoading(true); setError(null)
    scroll.current = 'bottom'
    const signal = abort.signal
    const initialLoad = communityRequest(endpoint, { signal }).then(data => {
      if (signal.aborted) return
      merge(data.posts)
      setCursor(data.nextCursor)
    }).catch(err => { if (!signal.aborted) setError(err.message) })
      .finally(() => { if (!signal.aborted) setLoading(false) })

    function connect() {
      if (stopped) return
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/chat`)
      socket.onopen = async () => {
        if (stopped) return
        attempt = 0; setConnected(true)
        await initialLoad
        if (stopped) return
        // Recover any messages missed while disconnected; IDs deduplicate races with live events.
        let after = latest.current
        try {
          while (!stopped) {
            const data = await communityRequest(`${endpoint}?after=${after}`, { signal })
            if (signal.aborted || !data.posts.length) break
            markScroll()
            merge(data.posts)
            after = Math.max(...data.posts.map(post => post.id))
            if (data.posts.length < 50) break
          }
        } catch (err) { if (!signal.aborted) setError(err.message) }
      }
      socket.onmessage = event => {
        if (stopped) return
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'message' && data.post) { markScroll(); merge([data.post]); setError(null) }
        } catch { /* Ignore malformed protocol messages. */ }
      }
      socket.onerror = () => socket.close()
      socket.onclose = () => {
        if (stopped) return
        setConnected(false)
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 10000))
      }
    }
    function markScroll() {
      const box = viewport.current
      if (!box || box.scrollHeight - box.scrollTop - box.clientHeight < 90) scroll.current = 'bottom'
    }
    if (chat) connect()
    return () => { stopped = true; abort.abort(); clearTimeout(timer); if (socket) { socket.onclose = null; socket.close() } }
  }, [endpoint, chat, retry])

  async function publish(event) {
    event.preventDefault()
    if (sending || reading || (!body.trim() && !image)) return
    setSending(true); setError(null)
    try {
      const data = await communityRequest(endpoint, { method: 'POST', body: { body, ...(chat && image ? { image } : {}) } })
      scroll.current = 'bottom'; followBottom.current = true; merge([data.post]); setBody(''); setImage(null)
    } catch (err) { setError(err.message) } finally { setSending(false) }
  }

  async function attach(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    setReading(true); setError(null)
    try { setImage(await readImage(file)) } catch (err) { setError(err.message) } finally { setReading(false) }
  }

  async function loadOlder() {
    if (more) return
    setMore(true)
    try {
      const data = await communityRequest(`${endpoint}?before=${cursor}`)
      if (chat && viewport.current) scroll.current = { height: viewport.current.scrollHeight, top: viewport.current.scrollTop }
      merge(data.posts); setCursor(data.nextCursor)
    } catch (err) { setError(err.message) } finally { setMore(false) }
  }

  const composer = user ? <form className="wall-compose" onSubmit={publish}>
    <label className="sr-only" htmlFor={chat ? 'chat-message' : 'game-comment'}>{chat ? 'Сообщение в чат' : 'Комментарий к игре'}</label>
    <textarea id={chat ? 'chat-message' : 'game-comment'} value={body} onChange={event => setBody(event.target.value)} maxLength={2000} rows={chat ? 2 : 3} placeholder={chat ? 'Написать в общий чат…' : 'Что думаете об игре?'} disabled={sending}
      onKeyDown={event => { if (chat && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form.requestSubmit() } }} />
    {image && <div className="wall-attachment"><img src={image} alt="Вложение к сообщению" /><button type="button" aria-label="Убрать вложение" disabled={sending} onClick={() => setImage(null)}><X size={16} /></button></div>}
    <div className="wall-compose-footer">{chat && <label className="profile-upload"><ImagePlus size={15} />{reading ? 'Загрузка…' : 'Картинка / GIF'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={sending || reading} onChange={attach} /></label>}<span>{body.length}/2000</span><button type="submit" disabled={sending || reading || (!body.trim() && !image)}><Send size={14} />{sending ? 'Отправка…' : 'Отправить'}</button></div>
  </form> : <p className="wall-guest">{chat ? 'Войдите через [ ENTER ], чтобы писать в чат.' : <Link to="/?login=1">Войдите, чтобы оставить комментарий.</Link>}</p>

  return <section className={`profile-wall discussion ${chat ? 'is-chat' : ''}`} aria-label={chat ? 'Общий чат' : 'Комментарии к игре'}>
    <div className="wall-title"><h2>{chat ? 'CHAT_VOID.exe' : 'COMMENTS.sys'}</h2><span>{chat ? connected ? '● ONLINE' : '○ CONNECTING…' : `${posts.length} ${cursor ? '+' : ''} ЗАПИСЕЙ`}</span></div>
    {error && <div className="discussion-error" role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>[ Повторить ]</button></div>}
    {!chat && composer}
    <div className={chat ? 'chat-viewport' : 'wall-posts'} ref={viewport} onScroll={() => { const box = viewport.current; if (box) followBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 90 }}>
      {chat && cursor && <button type="button" className="discussion-more" disabled={more} onClick={loadOlder}>{more ? 'Загрузка…' : '[ Ранние сообщения ]'}</button>}
      {loading ? <p className="profile-empty" role="status">[ LOADING… ]</p> : !posts.length && <p className="profile-empty">[ NO_MESSAGES ]<br />{chat ? 'Канал пуст. Начните разговор.' : 'Комментариев пока нет.'}</p>}
      {(chat ? [...posts].reverse() : posts).map(post => <article className="wall-post" key={post.id}>
        <Link to={`/profile/${post.author.id}`} className="wall-author-avatar"><span className="profile-avatar is-small">{post.author.avatarURL ? <img src={post.author.avatarURL} alt={`Аватар ${post.author.nickname}`} /> : <UserRound size={20} strokeWidth={1} aria-hidden="true" />}</span></Link>
        <div className="wall-post-content"><div className="wall-post-meta"><Link to={`/profile/${post.author.id}`}>{post.author.nickname}</Link><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</time></div>{post.body && <p className="wall-post-text">{post.body}</p>}{post.imageURL && <a href={post.imageURL} target="_blank" rel="noreferrer"><img className="wall-post-image" src={post.imageURL} alt="Изображение в чате" onLoad={() => { if (chat && followBottom.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight }} /></a>}</div>
      </article>)}
    </div>
    {!chat && cursor && <button type="button" className="discussion-more" disabled={more} onClick={loadOlder}>{more ? 'Загрузка…' : '[ Показать ещё ]'}</button>}
    {chat && composer}
  </section>
}
