import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Discussion from './Discussion'
import GameRating from './GameRating'

export default function GamePage() {
  const { id } = useParams()
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const updateRating = useCallback(average => setGame(current => current ? { ...current, rate: average } : current), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/games/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Игра не найдена')
        return r.json()
      })
      .then(data => {
        if (cancelled) return
        setGame(data)
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        setError(e.message)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="py-20 text-center text-zinc-500 font-mono text-xs animate-pulse">[ LOADING_GAME_DATA... ]</div>
  if (error) return <div className="py-20 text-center text-red-500 font-mono text-xs">[ ERROR: {error} ]</div>

  const year = game.releaseDate ? new Date(game.releaseDate).getFullYear() : null
  
  // Формируем прямой путь к файлу игры. 
  // В базе: sfwURL = "jacksmith/jacksmith.swf"
  // На выходе: /games/jacksmith/jacksmith.swf
  const swfUrl = game.sfwURL ? `/games/${game.sfwURL}` : null;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-6 font-mono relative z-10">
      <div className="border border-white/70 bg-[#1a1a1a] shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_8px_24px_rgba(0,0,0,0.8)]">
        
        {/* Шапка окна */}
        <div className="flex items-center justify-between border-b border-white/70 bg-[#0d0d0d] px-2 py-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-widest text-white">HARDWARE_CATALOG.EXE</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="flex h-4 w-5 items-center justify-center border border-white/70 text-[9px] font-bold text-white">?</span>
            <span className="flex h-4 w-5 items-center justify-center border border-white/70 text-[9px] font-bold text-white">✕</span>
          </div>
        </div>

        {/* Меню */}
        <div className="flex items-center gap-5 border-b border-white/40 bg-[#0d0d0d] px-3 py-1 text-[11px] text-white">
          <span className="cursor-default underline decoration-white/40 underline-offset-2">File</span>
          <span className="cursor-default underline decoration-white/40 underline-offset-2">View</span>
          <span className="cursor-default underline decoration-white/40 underline-offset-2">Help</span>
        </div>

        {/* Обложка */}
        <div className="relative aspect-[3/1] w-full overflow-hidden bg-black">
          {game.imageURL ? (
            <img src={game.imageURL} alt={game.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] tracking-widest text-white/40">[ NO_IMAGE ]</div>
          )}
        </div>

        {/* Инфо о игре */}
        <div className="px-4 pt-4 pb-2 text-white border-b border-white/15">
          <div className="mb-2 flex items-start justify-between gap-3">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{game.title}</h1>
            {year && <span className="shrink-0 border border-white/70 bg-black px-2 py-0.5 text-[11px] font-bold">{year} г.</span>}
          </div>
          <p className="text-[13px] leading-snug text-white/70 mb-4">{game.description}</p>
          
          <div className="grid grid-cols-2 gap-4 text-[12px] border-t border-white/10 pt-3">
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-white/45">Фильтры:</span> <span className="font-bold">{game.filters?.join(', ') || '—'}</span></div>
              <div className="flex justify-between"><span className="text-white/45">Разработчик:</span> <span className="font-bold">{game.developer || '—'}</span></div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-white/45">Рейтинг:</span> <span className="font-bold">{game.rate ? `${game.rate}*` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-white/45">Скачивания:</span> <span className="font-bold">{game.uploads || '—'}</span></div>
            </div>
          </div>
        </div>

        {/* Плеер Ruffle */}
        <div className="game-download"><a href={`/api/games/${id}/download`} download>[ ↓ Скачать SWF ]</a><span>Оригинальный файл игры</span></div>
        <div className="p-4 bg-black flex justify-center">
          {swfUrl ? (
            <div className="w-full aspect-video bg-[#1a1a1a] border border-white/20 flex items-center justify-center relative">
               <div id="ruffle-container" className="w-full h-full absolute inset-0">
                 <embed src={swfUrl} width="100%" height="100%" type="application/x-shockwave-flash" title={game.title} />
               </div>
            </div>
          ) : (
            <div className="w-full aspect-video bg-[#1a1a1a] flex items-center justify-center text-zinc-600 text-xs border border-dashed border-zinc-800">
              [ GAME_FILE_NOT_FOUND ]
            </div>
          )}
        </div>

        <GameRating gameId={id} onChange={updateRating} />
        <div className="p-4"><Discussion key={id} endpoint={`/api/games/${id}/comments`} /></div>

      </div>
    </div>
  )
}
