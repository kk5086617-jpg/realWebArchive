import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ArchivePage from './ArchivePage'

const games = [
  { id: 1, title: 'Snail Bob 3', filters: ['Puzzle', 'Management'] },
  { id: 2, title: 'Papas Freezeria', filters: ['Management'] },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url === '/api/filters') return {
      ok: true,
      json: async () => [{ id: 1, name: 'Puzzle' }, { id: 2, name: 'Management' }],
    }
    const params = new URL(url, 'http://localhost').searchParams
    const q = (params.get('q') || '').toLowerCase()
    const filters = params.get('filters')?.split(',') || []
    const items = games.filter(game => game.title.toLowerCase().includes(q)
      && filters.every(filter => game.filters.includes(filter)))
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

  it('выбирает несколько фильтров и сбрасывает их без сброса поиска', async () => {
    const user = userEvent.setup()
    render(<ArchivePage activeTab="ARCHIVE" />)
    await screen.findByText('Snail Bob 3')
    await user.click(screen.getByRole('button', { name: '[ Filters ]' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Puzzle' }))
    await waitFor(() => expect(screen.queryByText('Papas Freezeria')).not.toBeInTheDocument())
    await user.click(screen.getByRole('checkbox', { name: 'Management' }))
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/games?page=1&limit=20&filters=Puzzle%2CManagement'))
    expect(screen.getByText('Snail Bob 3')).toBeInTheDocument()
    expect(screen.queryByText('Papas Freezeria')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Puzzle' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Management' })).toBeChecked()
    await user.type(screen.getByPlaceholderText('Search ...'), 'snail')
    await user.click(screen.getByText('[ search ]'))
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/games?page=1&limit=20&q=snail&filters=Puzzle%2CManagement'))
    await user.click(screen.getByRole('button', { name: '[ Сбросить фильтры ]' }))
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/games?page=1&limit=20&q=snail'))
    expect(screen.getByPlaceholderText('Search ...')).toHaveValue('snail')
    expect(screen.getByRole('checkbox', { name: 'Puzzle' })).not.toBeChecked()
  })

  it('закрывает панель по Escape и сохраняет выбранные фильтры', async () => {
    const user = userEvent.setup()
    render(<ArchivePage activeTab="ARCHIVE" />)
    const button = screen.getByRole('button', { name: '[ Filters ]' })
    await user.click(button)
    await user.click(await screen.findByRole('checkbox', { name: 'Puzzle' }))
    await user.keyboard('{Escape}')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()
    expect(screen.queryByRole('region', { name: 'Фильтры игр' })).not.toBeInTheDocument()
    await user.click(button)
    expect(await screen.findByRole('checkbox', { name: 'Puzzle' })).toBeChecked()
  })

  it('повторяет загрузку фильтров после ошибки, не скрывая каталог', async () => {
    const user = userEvent.setup()
    render(<ArchivePage activeTab="ARCHIVE" />)
    await screen.findByText('Snail Bob 3')
    fetch.mockResolvedValueOnce({ ok: false, status: 503 })
    await user.click(screen.getByRole('button', { name: '[ Filters ]' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 503')
    expect(screen.getByText('Snail Bob 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('checkbox', { name: 'Puzzle' })).toBeInTheDocument()
  })
})
