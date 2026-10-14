import React from 'react'

// Пропсы:
// game: {
//   id, title, description, imageURL,
//   sfwURL, uploads, rate, releaseDate,
//   filters: string[]   // теги из другой таблицы
// }
// onOpen?: (id) => void   // если передан — вызывается при клике
// href?: string           // альтернатива: обычная ссылка

export default function GameCard({ game, onOpen, href }) {
  const {
    id,
    title,
    description,
    imageURL,
    uploads,
    rate,
    releaseDate,
    filters = [],
  } = game

  const year = releaseDate ? new Date(releaseDate).getFullYear() : null
  const filtersLine = filters.join(', ')

  const handleClick = (e) => {
    if (onOpen) {
      e.preventDefault()
      onOpen(id)
    }
    // если onOpen нет — сработает обычный переход по href
  }

  const Wrapper = href && !onOpen ? 'a' : 'div'
  const wrapperProps =
    href && !onOpen
      ? { href, onClick: handleClick }
      : { onClick: handleClick, role: 'button', tabIndex: 0,
          onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e) } }

  return (
    <Wrapper
      {...wrapperProps}
      className="game-card group block w-full cursor-pointer select-none"
    >
      {/* ── Окно ─────────────────────────────────── */}
      <div className="border border-white/70 bg-[#1a1a1a] shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_8px_24px_rgba(0,0,0,0.8)] transition-colors duration-150 group-hover:border-white">
        {/* ── Шапка окна ───────────────────────── */}
        <div className="flex items-center justify-between border-b border-white/70 bg-[#0d0d0d] px-2 py-1">
          <div className="flex items-center gap-2">
            {/* иконка дискеты */}
            <span className="flex h-4 w-4 items-center justify-center border border-white/70 bg-[#1a1a1a]">
              <svg viewBox="0 0 16 16" className="h-2.5 w-2.5 fill-white">
                <path d="M2 1h10l2 2v12H2V1zm2 1v4h8V2H4zm1 6h6v5H5V8z" />
              </svg>
            </span>
            <span className="text-[10px] font-bold tracking-widest text-white">
              HARDWARE_CATALOG.EXE
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="flex h-4 w-5 items-center justify-center border border-white/70 text-[9px] font-bold text-white">
              ?
            </span>
            <span className="flex h-4 w-5 items-center justify-center border border-white/70 text-[9px] font-bold text-white">
              ✕
            </span>
          </div>
        </div>

        {/* ── Меню ─────────────────────────────── */}
        <div className="flex items-center gap-5 border-b border-white/40 bg-[#0d0d0d] px-3 py-1 text-[11px] text-white">
          <span className="cursor-default underline decoration-white/40 underline-offset-2">File</span>
          <span className="cursor-default underline decoration-white/40 underline-offset-2">View</span>
          <span className="cursor-default underline decoration-white/40 underline-offset-2">Help</span>
        </div>

        {/* ── Превью ───────────────────────────── */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-black">
          {imageURL ? (
            <img
              src={imageURL}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] tracking-widest text-white/40">
              [ NO_IMAGE ]
            </div>
          )}
        </div>

        {/* ── Тело ─────────────────────────────── */}
        <div className="px-3 pt-3 pb-2 text-white">
          {/* Заголовок + год */}
          <div className="mb-2 flex items-start justify-between gap-3">
            <h3 className="text-lg font-extrabold leading-tight tracking-tight">
              {title}
            </h3>
            {year && (
              <span className="shrink-0 border border-white/70 bg-black px-2 py-0.5 text-[11px] font-bold">
                {year} г.
              </span>
            )}
          </div>

          {/* Описание */}
          {description && (
            <p className="text-[12px] leading-snug text-white/65 line-clamp-2 min-h-[33px]">
              {description || '\u00A0'} 
            </p>
          )}

          {/* Разделитель */}
          <div className="my-3 border-t border-white/15" />

          {/* Метаданные */}
          <dl className="space-y-1 text-[12px]">
            <MetaRow label="Фильтры:" value={filtersLine || '—'} />
            <MetaRow label="Рейтинг:" value={rate != null ? `${rate}*` : '—'} />
            <MetaRow label="Скачивания:" value={uploads != null ? uploads : '—'} />
          </dl>
        </div>

        {/* ── Статус-бар ───────────────────────── */}
        <div className="flex items-center justify-between border-t border-white/40 bg-[#0d0d0d] px-3 py-1 text-[10px] text-white/80">
          <span>Status: System Ready</span>
          <span>COM3 // 9600 Baud</span>
        </div>
      </div>
    </Wrapper>
  )
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-white/45">{label}</dt>
      <dd className="truncate text-right font-bold text-white">{value}</dd>
    </div>
  )
}