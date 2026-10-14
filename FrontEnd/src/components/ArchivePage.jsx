import React, { useMemo, useState } from 'react'
import GameCard from './GameCard'

// ─────────────────────────────────────────────────────────────
//  МОКОВЫЕ ДАННЫЕ (без изменений)
// ─────────────────────────────────────────────────────────────

const FLASH_TITLES = [
  'Snail Bob 3', 'Papas Freezeria', 'Bloons TD 5', 'Age of War',
  'Learn to Fly 2', 'Duck Life 4', 'Papa Louie 2', 'Run 2',
  'Fireboy and Watergirl', 'Happy Wheels', 'Super Meat Boy', 'Alien Hominid',
  'Boxhead 2Play', 'Cactus McCoy', 'Sonny 2', 'Epic Battle Fantasy 4',
  'Kingdom Rush', 'Gemcraft', 'Kingdom of Loathing', 'Burrito Bison',
  'Doodle Jump', 'Line Rider', 'QWOP', 'Bubble Tanks 2',
  'Tanks', 'Territory War', 'Stick War', 'Crush the Castle',
  'Bloxorz', 'Bloons Monkey City', 'Papa\'s Sushiria', 'Jacksmith',
  'Fancy Pants Adventure', 'N', 'Continuity', 'Frost Bite',
  'Moto X3M', 'Stick Ranger', 'SAS: Zombie Assault', 'Zombotron',
  'Raze', 'Storm the House', 'Thing-Thing Arena', 'Madness Interactive',
  'Interactive Buddy', 'Bowman 2', 'Kitten Cannon', 'Pandemic 2',
  'Desktop Tower Defense', 'Battleship', 'The Last Stand', 'Rebuild',
  'Cursed Treasure', 'Paladog', 'Papa\'s Cupcakeria', 'Papa\'s Wingeria',
  'Papa\'s Pancakeria', 'Papa\'s Hot Doggeria', 'Papa\'s Bakeria', 'Papa\'s Taco Mia',
]

const FILTER_POOL = [
  'Adventure', 'Puzzle', 'Action', 'Arcade', 'Strategy',
  'Racing', 'Shooter', 'Platformer', 'Tower Defense', 'Clicker',
  'Sports', 'Cooking', 'Zombie', 'Physics', 'Logic',
]

const DESCRIPTIONS = [
  'Приключенческая головоломка про улитку в крутой кепке лол',
  'Классический тайм-менеджер про управление рестораном',
  'Стратегия в реальном времени с защитой башнями',
  'Физическая аркада с забавными персонажами',
  'Казуальная головоломка на реакцию и логику',
  'Экшен-платформер с элементами выживания',
  'Экономическая стратегия с прокачкой и апгрейдами',
  'Бесконечный раннер с процедурной генерацией',
  'Кооперативная головоломка на двоих за одной клавиатурой',
  'Кровавый экшен с зомби и выживанием',
]

function seeded(seed) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function pick(arr, seed) {
  return arr[Math.floor(seeded(seed) * arr.length)]
}

function makeGames(count = 60) {
  const games = []
  for (let i = 0; i < count; i++) {
    const seed = i + 1
    const title = FLASH_TITLES[i % FLASH_TITLES.length] + (i >= FLASH_TITLES.length ? ` ${Math.floor(i / FLASH_TITLES.length) + 1}` : '')
    const filterCount = 1 + Math.floor(seeded(seed * 3) * 2)
    const filters = []
    for (let f = 0; f < filterCount; f++) {
      const tag = pick(FILTER_POOL, seed * 7 + f * 13)
      if (!filters.includes(tag)) filters.push(tag)
    }
    games.push({
      id: i + 1,
      title,
      description: pick(DESCRIPTIONS, seed * 11),
      imageURL: '',
      sfwURL: `/games/${i + 1}-sfw.raff`,
      uploads: 100 + Math.floor(seeded(seed * 5) * 40000),
      rate: 1 + Math.floor(seeded(seed * 9) * 10),
      releaseDate: `${2005 + Math.floor(seeded(seed * 13) * 18)}-01-01`,
      filters,
    })
  }
  return games
}

const ALL_GAMES = makeGames(60)
const LIMIT = 20

// ─────────────────────────────────────────────────────────────
//  ПАГИНАЦИЯ
// ─────────────────────────────────────────────────────────────
function buildPagination(page, total, windowSize = 2) {
  if (total <= 1) return [1]
  const pages = new Set()
  pages.add(1)
  pages.add(total)
  for (let i = page - windowSize; i <= page + windowSize; i++) {
    if (i >= 1 && i <= total) pages.add(i)
  }
  const sorted = Array.from(pages).sort((a, b) => a - b)
  const result = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('…')
    result.push(p)
    prev = p
  }
  return result
}

// ─────────────────────────────────────────────────────────────
//  ARCHIVE PAGE
// ─────────────────────────────────────────────────────────────
export default function ArchivePage() {
  const [page, setPage] = useState(1)
  // то, что введено в поле
  const [query, setQuery] = useState('')
  // то, что реально применилось после Enter / клика по 🔍
  const [appliedQuery, setAppliedQuery] = useState('')

  // 1) Фильтруем все игры по appliedQuery (title, без учёта регистра)
  const filteredGames = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase()
    if (!q) return ALL_GAMES
    return ALL_GAMES.filter((g) => g.title.toLowerCase().includes(q))
  }, [appliedQuery])

  // 2) Считаем общее число страниц уже по результатам поиска
  const totalPages = Math.max(1, Math.ceil(filteredGames.length / LIMIT))

  // 3) Срез под текущую страницу
  const games = useMemo(() => {
    const start = (page - 1) * LIMIT
    return filteredGames.slice(start, start + LIMIT)
  }, [filteredGames, page])

  const pagination = useMemo(
    () => buildPagination(page, totalPages),
    [page, totalPages]
  )

  // Применить поиск: сбросить страницу на 1 и запомнить запрос
  const applySearch = () => {
    setAppliedQuery(query)
    setPage(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Очистить поле и сбросить результаты поиска
const clearSearch = () => {
  setQuery('')
  setAppliedQuery('')
  setPage(1)
}

  // Enter в поле — тот же эффект, что клик по 🔍
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      applySearch()
    }
  }

  const handleOpen = (id) => {
    console.log('open game', id)
  }

  const goTo = (p) => {
    if (p < 1 || p > totalPages) return
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-6 font-mono relative z-10">

      {/* ВЕРХНИЙ БЛОК: СТРОКА ПОИСКА И КНОПКА ФИЛЬТРОВ */}
<div className="flex gap-4 items-center">
  <div className="flex bg-black border border-white max-w-md w-full">

    {/* Поле ввода */}
    <input
      type="text"
      placeholder="Search ..."
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={handleKeyDown}
      className="flex-1 bg-transparent px-3 py-2 text-xs focus:outline-none placeholder-zinc-700 text-white"
    />

    {/* Крестик — виден только когда в поле есть текст */}
    {query && (
      <button
        className="px-3 border-l border-white text-xs text-zinc-400 hover:text-white transition-colors"
        type="button"
        onClick={clearSearch}
        aria-label="Очистить"
      >
        [ ✕ ]
      </button>
    )}

    {/* Кнопка поиска */}
    <button
      className="px-3 border-l border-white text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
      type="button"
      onClick={applySearch}
      aria-label="Найти"
    >
      [ search ]
    </button>
  </div>

  <button
    className="bg-black border border-white text-[10px] font-bold px-5 py-2.5 uppercase tracking-wider hover:bg-white hover:text-black transition-colors"
    type="button"
  >
    [ Filters ]
  </button>
</div>

      {/* ОСНОВНАЯ ПЛАШКА */}
      <div className="bg-black border-2 border-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)]">

        {/* Сетка карточек либо заглушка «ничего не найдено» */}
        {games.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {games.map((game) => (
              <GameCard key={game.id} game={game} onOpen={handleOpen} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-zinc-700 text-xs tracking-widest border border-dashed border-zinc-800">
            [ NO_RESULTS_FOUND ]
          </div>
        )}

        {/* ─── ПАГИНАЦИЯ ─────────────────────────────── */}
        {games.length > 0 && (
          <nav
            aria-label="Пагинация"
            className="mt-8 flex flex-wrap items-center justify-center gap-1.5 text-[11px] select-none"
          >
            <PageToken
              disabled={page === 1}
              onClick={() => goTo(page - 1)}
              label="[ < ]"
            />

            {pagination.map((token, idx) =>
              token === '…' ? (
                <span key={`dots-${idx}`} className="px-1 text-zinc-600">
                  …
                </span>
              ) : (
                <PageToken
                  key={token}
                  active={token === page}
                  onClick={() => goTo(token)}
                  label={`[ ${token} ]`}
                />
              )
            )}

            <PageToken
              disabled={page === totalPages}
              onClick={() => goTo(page + 1)}
              label="[ > ]"
            />
          </nav>
        )}

      </div>

    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Кнопка-токен пагинации
// ─────────────────────────────────────────────────────────────
function PageToken({ label, active, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'px-1.5 py-0.5 transition-colors',
        active
          ? 'bg-white text-black font-bold'
          : 'text-zinc-400 hover:text-white',
        disabled
          ? 'opacity-30 cursor-not-allowed'
          : 'cursor-pointer',
      ].join(' ')}
    >
      {label}
    </button>
  )
}