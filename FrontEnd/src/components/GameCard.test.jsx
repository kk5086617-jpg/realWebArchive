import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GameCard from './GameCard'

const mockGame = {
  id: 1,
  title: 'Snail Bob 3',
  description: 'Приключенческая головоломка про улитку',
  imageURL: '',
  sfwURL: '/games/1-sfw.swf',
  uploads: 12441,
  rate: 10,
  releaseDate: '2012-05-01',
  filters: ['Adventure', 'Puzzle'],
}

describe('GameCard', () => {
  it('рендерит заголовок, год и метаданные', () => {
    render(<GameCard game={mockGame} />)

    expect(screen.getByText('Snail Bob 3')).toBeInTheDocument()
    expect(screen.getByText('2012 г.')).toBeInTheDocument()
    expect(screen.getByText(/Adventure, Puzzle/)).toBeInTheDocument()
    expect(screen.getByText('10*')).toBeInTheDocument()
    expect(screen.getByText('12441')).toBeInTheDocument()
  })

  it('вызывает onOpen с id при клике', async () => {
    const onOpen = vi.fn()
    render(<GameCard game={mockGame} onOpen={onOpen} />)

    await userEvent.click(screen.getByText('Snail Bob 3'))
    expect(onOpen).toHaveBeenCalledWith(1)
  })
})