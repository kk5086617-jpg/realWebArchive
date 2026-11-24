import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [availableFilters, setAvailableFilters] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [filtersError, setFiltersError] = useState(null);
  const [filtersRetry, setFiltersRetry] = useState(0);
  const filtersButtonRef = useRef(null);

  useEffect(() => {
    if (!filtersOpen || activeTab !== 'ARCHIVE') return;

    const controller = new AbortController();
    setFiltersLoading(true);
    setFiltersError(null);

    async function loadFilters() {
      try {
        const response = await fetch('/api/filters', { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!controller.signal.aborted) setAvailableFilters(data);
      } catch (err) {
        if (!controller.signal.aborted) setFiltersError(err.message);
      } finally {
        if (!controller.signal.aborted) setFiltersLoading(false);
      }
    }

    loadFilters();
    return () => controller.abort();
  }, [filtersOpen, activeTab, filtersRetry]);

  useEffect(() => {
    if (activeTab !== 'ARCHIVE') return; // Грузим данные только для вкладки Архив

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page, limit: LIMIT });
    if (appliedQuery) params.set('q', appliedQuery);
    if (selectedFilters.length) params.set('filters', selectedFilters.join(','));

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
  }, [page, appliedQuery, activeTab, selectedFilters]);

  const toggleFilter = (name) => {
    setSelectedFilters(current => current.includes(name)
      ? current.filter(filter => filter !== name)
      : [...current, name]);
    setPage(1);
  };

  const resetFilters = () => {
    setSelectedFilters([]);
    setPage(1);
  };

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
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex bg-black border border-white max-w-md w-full min-w-0">
          <input
            type="text"
            placeholder="Search ..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-transparent px-3 py-2 text-xs focus:outline-none placeholder-zinc-700 text-white"
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
        <button
          ref={filtersButtonRef}
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="archive-filters"
          onClick={() => setFiltersOpen(open => !open)}
          className={`border border-white text-[10px] font-bold px-5 py-2.5 uppercase tracking-wider hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${filtersOpen || selectedFilters.length ? 'bg-white text-black' : 'bg-black text-white'}`}
        >
          [ Filters ]
          {selectedFilters.length > 0 && <span> ({selectedFilters.length})</span>}
        </button>
      </div>

      {filtersOpen && (
        <section
          id="archive-filters"
          aria-label="Фильтры игр"
          onKeyDown={event => {
            if (event.key === 'Escape') {
              setFiltersOpen(false);
              filtersButtonRef.current?.focus();
            }
          }}
          className="border border-white/70 bg-[#0d0d0d] shadow-[4px_4px_0_0_rgba(255,255,255,0.15)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/30 px-4 py-2">
            <h2 className="text-[11px] font-bold tracking-widest">[ FILTERS ]</h2>
            <button type="button" onClick={resetFilters} disabled={!selectedFilters.length} className="text-[11px] text-white/70 hover:text-white disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-white">
              [ Сбросить фильтры ]
            </button>
          </div>
          <div className="p-4">
            <p className="mb-4 text-xs text-white/60">Выберите один или несколько тегов. Подойдут только игры со всеми выбранными тегами.</p>
            {filtersLoading ? (
              <p role="status" className="text-xs text-white/60">[ Загрузка фильтров… ]</p>
            ) : filtersError ? (
              <div role="alert" className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-red-400">Не удалось загрузить фильтры: {filtersError}</span>
                <button type="button" onClick={() => setFiltersRetry(value => value + 1)} className="border border-white/50 px-3 py-2 hover:bg-white hover:text-black">Повторить</button>
              </div>
            ) : availableFilters.length ? (
              <fieldset>
                <legend className="sr-only">Теги игр</legend>
                <div className="flex flex-wrap gap-2">
                  {availableFilters.map(filter => (
                    <label key={filter.id} className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-xs transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white ${selectedFilters.includes(filter.name) ? 'border-white bg-white text-black' : 'border-white/40 bg-black text-white/80 hover:border-white'}`}>
                      <input type="checkbox" checked={selectedFilters.includes(filter.name)} onChange={() => toggleFilter(filter.name)} className="h-3.5 w-3.5 accent-zinc-500" />
                      {filter.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="text-xs text-white/60">[ Доступных фильтров пока нет ]</p>
            )}
          </div>
        </section>
      )}

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
