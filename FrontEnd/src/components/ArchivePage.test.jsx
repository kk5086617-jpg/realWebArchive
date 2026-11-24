import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ArchivePage from './ArchivePage'

const games = [
  { id: 1, title: 'Snail Bob 3', filters: ['Puzzle'] },
  { id: 2, title: 'Papas Freezeria', filters: ['Management'] },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const params = new URL(url, 'http://localhost').searchParams
    const q = (params.get('q') || '').toLowerCase()
    const items = games.filter(game => game.title.toLowerCase().includes(q))
    return { ok: true, json: async () => ({ items, total: items.length }) }
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('ArchivePage', () => {
  it('загружает каталог через API', async () => {
    render(<ArchivePage activeTab="ARCHIVE" />)

    expect(screen.getByPlaceholderText('Search ...')).toBeInTheDocument()
    expect(screen.getByText('[ Filters ]')).toBeInTheDocument()
    expect(await screen.findByText('Snail Bob 3')).toBeInTheDocument()
    expect(screen.getByText('Papas Freezeria')).toBeInTheDocument()
  })

  it('фильтрует карточки по поисковому запросу', async () => {
    render(<ArchivePage activeTab="ARCHIVE" />)
    await screen.findByText('Papas Freezeria')

    const input = screen.getByPlaceholderText('Search ...')
    await userEvent.type(input, 'snail')
    await userEvent.click(screen.getByText('[ search ]'))
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/games?page=1&limit=20&q=snail'))
    await screen.findByText('Snail Bob 3')
    expect(screen.getAllByText(/Snail Bob/i).length).toBeGreaterThan(0)
    expect(screen.queryByText('Papas Freezeria')).not.toBeInTheDocument()
  })

  it('показывает ошибку недоступного API', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503 })
    render(<ArchivePage activeTab="ARCHIVE" />)
    expect(await screen.findByText('[ ERROR: HTTP 503 ]')).toBeInTheDocument()
  })
})
