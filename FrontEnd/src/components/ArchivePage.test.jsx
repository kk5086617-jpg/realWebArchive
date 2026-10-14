import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ArchivePage from './ArchivePage'

describe('ArchivePage', () => {
  it('рендерит строку поиска и кнопку фильтров', () => {
    render(<ArchivePage />)

    expect(screen.getByPlaceholderText('Search ...')).toBeInTheDocument()
    expect(screen.getByText('[ Filters ]')).toBeInTheDocument()
  })

  it('фильтрует карточки по поисковому запросу', async () => {
    render(<ArchivePage />)

    const input = screen.getByPlaceholderText('Search ...')
    await userEvent.type(input, 'snail')
    await userEvent.click(screen.getByText('[ search ]'))

    expect(screen.getAllByText(/Snail Bob/i).length).toBeGreaterThan(0)
    expect(screen.queryByText('Papas Freezeria')).not.toBeInTheDocument()
  })
})