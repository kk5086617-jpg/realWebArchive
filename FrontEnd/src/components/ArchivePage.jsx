import React, { useEffect, useState, useMemo } from 'react';
import GameCard from './GameCard';

const LIMIT = 20;

function buildPagination(page, total, windowSize = 2) {
  if (total <= 1) return [1];
  const pages = new Set([1, total]);
  for (let i = page - windowSize; i <= page + windowSize; i++) {
    if (i >= 1 && i <= total) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export default function ArchivePage({ activeTab }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [games, setGames] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (activeTab !== 'ARCHIVE') return; // Грузим данные только для вкладки Архив

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page, limit: LIMIT });
    if (appliedQuery) params.set('q', appliedQuery);

    fetch(`/api/games?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setGames(data.items);
        setTotalPages(Math.max(1, Math.ceil(data.total / LIMIT)));
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [page, appliedQuery, activeTab]);

  const pagination = useMemo(() => buildPagination(page, totalPages), [page, totalPages]);
  
  const applySearch = () => {
    setAppliedQuery(query);
    setPage(1);
  };
  
  const clearSearch = () => {
    setQuery('');
    setAppliedQuery('');
    setPage(1);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applySearch();
    }
  };
  
  const goTo = (p) => {
    if (p >= 1 && p <= totalPages) setPage(p);
  };

  // Если открыта не вкладка Архив, показываем заглушки
  if (activeTab !== 'ARCHIVE') {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-16 text-center text-zinc-500 font-mono border border-white/20 bg-black">
        [ {activeTab.replace(/[\[\] ]/g, '')}_PAGE_WIP ]
      </div>
    );
  }

  // Рендер Каталога
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-6 font-mono relative z-10">
      <div className="flex gap-4 items-center">
        <div className="flex bg-black border border-white max-w-md w-full">
          <input
            type="text"
            placeholder="Search ..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent px-3 py-2 text-xs focus:outline-none placeholder-zinc-700 text-white"
          />
          {query && (
            <button className="px-3 border-l border-white text-xs text-zinc-400 hover:text-white" type="button" onClick={clearSearch}>
              [ ✕ ]
            </button>
          )}
          <button className="px-3 border-l border-white text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white" type="button" onClick={applySearch}>
            [ search ]
          </button>
        </div>
        <button className="bg-black border border-white text-[10px] font-bold px-5 py-2.5 uppercase tracking-wider hover:bg-white hover:text-black">
          [ Filters ]
        </button>
      </div>

      <div className="bg-black border-2 border-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)]">
        {loading ? (
          <div className="py-16 text-center text-zinc-500 text-xs tracking-widest animate-pulse">[ LOADING_DATA... ]</div>
        ) : error ? (
          <div className="py-16 text-center text-red-500 text-xs tracking-widest border border-red-900">[ ERROR: {error} ]</div>
        ) : games.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {games.map((g) => <GameCard key={g.id} game={g} />)}
          </div>
        ) : (
          <div className="py-16 text-center text-zinc-700 text-xs tracking-widest border border-dashed border-zinc-800">[ NO_RESULTS_FOUND ]</div>
        )}

        {!loading && !error && games.length > 0 && (
          <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5 text-[11px] select-none">
            <PageToken disabled={page === 1} onClick={() => goTo(page - 1)} label="[ < ]" />
            {pagination.map((t, i) =>
              t === '…' ? (
                <span key={`d${i}`} className="px-1 text-zinc-600">…</span>
              ) : (
                <PageToken key={t} active={t === page} onClick={() => goTo(t)} label={`[ ${t} ]`} />
              )
            )}
            <PageToken disabled={page === totalPages} onClick={() => goTo(page + 1)} label="[ > ]" />
          </nav>
        )}
      </div>
    </div>
  );
}

function PageToken({ label, active, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'px-1.5 py-0.5 transition-colors',
        active ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white',
        disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {label}
    </button>
  );
}