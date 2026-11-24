import React, { useEffect, useState } from 'react'
import { Routes, Route, useLocation, Link, useNavigate } from 'react-router-dom'
import { Send, Mail, Phone, Menu, X } from 'lucide-react'
import ArchivePage from './components/ArchivePage'
import GamePage from './components/GamePage'
import AuthWindow from './components/AuthWindow'
import ProfilePage from './components/ProfilePage'
import { useAuth } from './auth/AuthContext'
import Discussion from './components/Discussion'

const navItems = ['[ ENTER ]', 'ARCHIVE', 'PROFILE', 'SUBMIT', 'CHAT_VOID']

export default function AppLayout() {
  const [active, setActive] = useState('ARCHIVE')
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const visibleNavItems = navItems.filter(item => item !== '[ ENTER ]' || (!user && !loading))
  const location = useLocation()
  useEffect(() => {
    if (new URLSearchParams(location.search).has('login')) setActive(user ? 'ARCHIVE' : '[ ENTER ]')
  }, [location.search, user])

  useEffect(() => {
    if (user) setActive(current => current === '[ ENTER ]' ? 'ARCHIVE' : current)
  }, [user])

  function selectTab(item) {
    if (item === 'PROFILE' && user) { navigate(`/profile/${user.id}`); setActive('PROFILE'); setMobileOpen(false); return }
    navigate('/')
    setActive(item === 'PROFILE' && !user ? '[ ENTER ]' : item)
    setMobileOpen(false)
  }
  
  const isProfilePage = location.pathname.startsWith('/profile/')
  // Если путь начинается с /game, мы скрываем кнопки навигации
  const isGamePage = location.pathname.startsWith('/game')

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white selection:bg-white selection:text-black flex flex-col">
      <div className="star-field" aria-hidden="true" />

      <header className="system-bar relative z-20 flex items-center justify-between gap-4 border-b border-white/15 px-5">
        <div className="system-left">
          <span><i /> CORE_SYS: <b>ONLINE_V2.0</b></span>
          <span><i /> SECURE_PORT: <b>NODE_666</b></span>
        </div>
        <div className="system-center">
          <span className="signal" aria-hidden="true">▰ ▰ ▰</span>
          <b>CRITICAL OVERDRIVE</b>
          <span className="signal" aria-hidden="true">▰ ▰ ▰</span>
        </div>
        <div className="system-right">
          <span><i /> SYS_LOAD: <b>94.2%</b></span>
          <span><i /> PING: <b>12ms</b></span>
        </div>
      </header>

      <section className="hero relative">
        <div className="artwork" aria-hidden="true" />
        
        {/* Логотип с кликом на главную */}
        <div className="brand-frame relative z-10 mx-auto">
          <Link to="/" className="block w-full h-full text-inherit no-underline">
            <div className="brand-inner">
              <span className="corner corner-tl" />
              <span className="corner corner-tr" />
              <span className="corner corner-bl" />
              <span className="corner corner-br" />
              <p className="eyebrow">— // HISTORIC CORE SYSTEM // —</p>
              {isGamePage ? <p className="brand-title">OurArchive</p> : <h1 className="brand-title">OurArchive</h1>}
              <p className="subtitle">SUB_LEVEL ARCHIVE // EST. 2010</p>
            </div>
          </Link>
        </div>

        <div className="ornament" aria-hidden="true"><span>†</span><i /> <b>■</b> <i /><span>†</span></div>

        <div className="mission-label"><span className="tiny-square" /> SELECT_MISSION:</div>
        <div className="system-status"><span>SYS_STAT [OK]</span><i /><i /><i /></div>

        {/* Навигация (скрывается на странице игры) */}
        {!isGamePage && (
          <>
            <nav className="desktop-nav relative z-10 flex flex-wrap items-center justify-center gap-2" aria-label="Основная навигация">
              {visibleNavItems.map((item) => (
                <button
                  key={item}
                  className={`nav-button ${(isProfilePage ? item === 'PROFILE' : active === item) ? 'is-active' : ''} ${item === '[ ENTER ]' ? 'is-enter' : ''}`}
                  onClick={() => selectTab(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </nav>

            <button className="mobile-menu" type="button" aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'} onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              <span>MISSION_MENU</span>
            </button>
            
            {mobileOpen && (
              <nav className="mobile-nav" aria-label="Мобильная навигация">
                {visibleNavItems.map((item) => (
                  <button key={item} className={`${(isProfilePage ? item === 'PROFILE' : active === item) ? 'is-active' : ''} ${item === '[ ENTER ]' ? 'is-enter' : ''}`} onClick={() => selectTab(item)} type="button">
                    {item}
                  </button>
                ))}
              </nav>
            )}
          </>
        )}
      </section>

      <section className="content-placeholder flex-grow" aria-label="Основная область страницы">
        <Routes>
          <Route path="/" element={active === '[ ENTER ]'
            ? <AuthWindow onClose={() => setActive('ARCHIVE')} onSuccess={() => setActive('ARCHIVE')} />
            : active === 'PROFILE'
              ? <ProfilePage onLogout={() => setActive('ARCHIVE')} />
              : active === 'CHAT_VOID'
                ? <div className="chat-window"><Discussion endpoint="/api/chat" chat /></div>
              : <ArchivePage activeTab={active} />} />
          <Route path="/game/:id" element={<GamePage />} />
          <Route path="/profile/:id" element={<ProfilePage key={location.pathname} onLogout={() => { setActive('ARCHIVE'); navigate('/') }} />} />
        </Routes>
      </section>

      <footer className="site-footer relative z-10 mt-auto">
        <div className="footer-contacts">
          <a href="https://t.me" target="_blank" rel="noreferrer"><Send size={19} strokeWidth={1.7} /><span>@Le_Pukich</span></a>
          <a href="mailto:kk5086617@gmail.com"><Mail size={19} strokeWidth={1.7} /><span>kk5086617@gmail.com</span></a>
          <a href="tel:+79133817248"><Phone size={19} strokeWidth={1.7} /><span>+7 (913) 381-72-48</span></a>
        </div>
      </footer>
    </main>
  )
}

