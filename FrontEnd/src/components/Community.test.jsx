import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Discussion from './Discussion'
import GameRating from './GameRating'

let authUser, sockets
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: authUser }) }))
const post = (id, body) => ({ id, body, createdAt: '2026-11-24T15:00:00Z', author: { id: 1, nickname: 'Player' } })
const response = data => ({ ok: true, json: async () => data })
beforeEach(() => {
  authUser = null; sockets = []
  vi.stubGlobal('WebSocket', class { constructor() { sockets.push(this) } close() {} })
})
afterEach(() => vi.unstubAllGlobals())

describe('Community', () => {
  it('отправляет картинку в чат без текста', async () => {
    authUser = { id: 1 }
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => response(options.method === 'POST'
      ? { post: { ...post(3, ''), imageURL: '/api/chat/3/image' } } : { posts: [], nextCursor: null })))
    const { container } = render(<MemoryRouter><Discussion endpoint="/api/chat" chat /></MemoryRouter>)
    await screen.findByText(/Канал пуст\. Начните разговор\./)
    const file = new File(['image-bytes'], 'picture.gif', { type: 'image/gif' })
    await userEvent.upload(container.querySelector('input[type=file]'), file)
    await screen.findByAltText('Вложение к сообщению')
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(await screen.findByAltText('Изображение в чате')).toHaveAttribute('src', '/api/chat/3/image')
    const sent = fetch.mock.calls.find(([, options]) => options?.method === 'POST')
    expect(JSON.parse(sent[1].body)).toEqual({ body: '', image: expect.stringMatching(/^data:image\/gif;base64,/) })
    expect(screen.queryByAltText('Вложение к сообщению')).not.toBeInTheDocument()
  })
  it('отображает историю и новые WebSocket-сообщения без дублей и ошибок прокрутки', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => response({ posts: url.includes('after=') ? [] : [post(1, 'История')], nextCursor: null })))
    render(<MemoryRouter><Discussion endpoint="/api/chat" chat /></MemoryRouter>)
    expect(await screen.findByText('История')).toBeInTheDocument()
    await act(async () => { await sockets[0].onopen() })
    await act(async () => { sockets[0].onmessage({ data: JSON.stringify({ type: 'message', post: post(2, 'Новое сообщение') }) }) })
    expect(screen.getByText('Новое сообщение')).toBeInTheDocument()
    await act(async () => { sockets[0].onmessage({ data: JSON.stringify({ type: 'message', post: post(2, 'Новое сообщение') }) }) })
    expect(screen.getAllByText('Новое сообщение')).toHaveLength(1)
    expect(screen.getByText('История')).toBeInTheDocument()
  })

  it('сохраняет новую оценку и показывает изменившееся среднее', async () => {
    authUser = { id: 1 }
    const onChange = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => response(options.method === 'PUT'
      ? { average: 4, count: 1, mine: 4 } : { average: null, count: 0, mine: null })))
    render(<MemoryRouter><GameRating gameId="2" onChange={onChange} /></MemoryRouter>)
    await screen.findByText('Пока без оценок')
    await userEvent.click(screen.getByRole('button', { name: 'Оценить на 4' }))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(4))
    expect(screen.getByRole('button', { name: 'Оценить на 4' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Ваша оценка: 4 / 5. Можно изменить.')).toBeInTheDocument()
  })
})
