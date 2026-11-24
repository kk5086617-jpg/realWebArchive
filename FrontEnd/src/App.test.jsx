import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import App from './App'

let sessionUser
beforeEach(() => {
  sessionUser = null
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    const result = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })
    if (url === '/api/auth/me') return result({ user: sessionUser })
    if (url === '/api/auth/login' || url === '/api/auth/register') {
      const { username, password } = JSON.parse(options.body)
      if (password === 'wrong-password') return result({ message: 'Неверный логин или пароль.' }, 401)
      sessionUser = { id: 1, username }
      return result({ user: sessionUser })
    }
    if (url === '/api/auth/logout') {
      sessionUser = null
      return result({ user: null })
    }
    if (url.startsWith('/api/games?')) return result({ items: [], total: 0 })
    if (/^\/api\/profiles\/\d+\/wall$/.test(url)) return result({ posts: [], nextCursor: null })
    if (/^\/api\/profiles\/\d+$/.test(url)) return result({ profile: { id: sessionUser?.id, nickname: sessionUser?.username, bio: '', avatarURL: null } })
    throw new Error(`Unexpected request ${url}`)
  }))
})
afterEach(() => vi.unstubAllGlobals())

function renderApp() {
  return render(<MemoryRouter><AuthProvider><App /></AuthProvider></MemoryRouter>)
}

describe('Авторизация', () => {
  it('показывает белую ENTER гостю, входит и скрывает кнопку', async () => {
    const user = userEvent.setup()
    renderApp()
    const enter = await screen.findByRole('button', { name: '[ ENTER ]' })
    expect(enter).toHaveClass('is-enter')
    await user.click(enter)
    expect(screen.getByRole('heading', { name: 'SYSTEM_LOGIN.exe' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Login:'), 'Roman')
    await user.type(screen.getByLabelText('Password:'), 'secret-pass-123')
    await user.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: '[ ENTER ]' })).not.toBeInTheDocument())
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', body: JSON.stringify({ username: 'Roman', password: 'secret-pass-123' }),
    }))
    await user.click(screen.getByRole('button', { name: 'PROFILE' }))
    expect(screen.getByText('Добро пожаловать, Roman.')).toBeInTheDocument()
  })

  it('восстанавливает сессию и возвращает ENTER после выхода', async () => {
    const user = userEvent.setup()
    sessionUser = { id: 7, username: 'ExistingUser' }
    renderApp()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.anything()))
    await user.click(screen.getByRole('button', { name: 'PROFILE' }))
    expect(await screen.findByText('Добро пожаловать, ExistingUser.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '[ ENTER ]' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '[ LOG OUT ]' }))
    expect(await screen.findByRole('button', { name: '[ ENTER ]' })).toHaveClass('is-enter')
  })

  it('проверяет повтор пароля при регистрации и создаёт аккаунт', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: '[ ENTER ]' }))
    await user.click(screen.getByRole('button', { name: 'Registration' }))
    await user.type(screen.getByLabelText('Login:'), 'NewUser')
    await user.type(screen.getByLabelText('Password:'), 'new-secret-123')
    await user.type(screen.getByLabelText('Repeat:'), 'different-123')
    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Пароли не совпадают.')
    expect(fetch).not.toHaveBeenCalledWith('/api/auth/register', expect.anything())
    await user.clear(screen.getByLabelText('Repeat:'))
    await user.type(screen.getByLabelText('Repeat:'), 'new-secret-123')
    await user.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: '[ ENTER ]' })).not.toBeInTheDocument())
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({ method: 'POST' }))
  })

  it('не авторизует при неверном пароле и позволяет закрыть окно', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: '[ ENTER ]' }))
    await user.type(screen.getByLabelText('Login:'), 'Roman')
    await user.type(screen.getByLabelText('Password:'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный логин или пароль.')
    expect(screen.getByRole('button', { name: '[ ENTER ]' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Закрыть окно авторизации' }))
    expect(screen.queryByRole('heading', { name: 'SYSTEM_LOGIN.exe' })).not.toBeInTheDocument()
  })
})
