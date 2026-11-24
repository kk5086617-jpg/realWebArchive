import { afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import GamePage from './GamePage'

afterEach(() => vi.unstubAllGlobals())

describe('GamePage', () => {
  it('загружает SWF через тот же домен без HTTP-адреса localhost', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => url.endsWith('/rating') ? { average: null, count: 0, mine: null } : url.endsWith('/comments') ? { posts: [], nextCursor: null } : { id: 2, title: 'Jacksmith', sfwURL: 'jacksmith/jacksmith.swf' },
    })))
    const { container } = render(
      <MemoryRouter initialEntries={['/game/2']}>
        <Routes><Route path="/game/:id" element={<GamePage />} /></Routes>
      </MemoryRouter>
    )
    await screen.findByText('Jacksmith')
    expect(fetch).toHaveBeenCalledWith('/api/games/2')
    expect(container.querySelector('embed')).toHaveAttribute('src', '/games/jacksmith/jacksmith.swf')
  })
})
