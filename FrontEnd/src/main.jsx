import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Send, Mail, Phone, Menu, X } from 'lucide-react'
import './style.css'
import ArchivePage from './components/ArchivePage'

const navItems = ['[ ENTER ]', 'ARCHIVE', 'PROFILE', 'SUBMIT', 'CHAT_VOID']

function App() {
  const [active, setActive] = useState('ARCHIVE')
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white selection:bg-white selection:text-black">
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
        <div className="brand-frame relative z-10 mx-auto">
          <div className="brand-inner">
            <span className="corner corner-tl" />
            <span className="corner corner-tr" />
            <span className="corner corner-bl" />
            <span className="corner corner-br" />
            <p className="eyebrow">— // HISTORIC CORE SYSTEM // —</p>
            <h1>OurArchive</h1>
            <p className="subtitle">SUB_LEVEL ARCHIVE // EST. 2010</p>
          </div>
        </div>

        <div className="ornament" aria-hidden="true"><span>†</span><i /> <b>■</b> <i /><span>†</span></div>

        <div className="mission-label"><span className="tiny-square" /> SELECT_MISSION:</div>
        <div className="system-status"><span>SYS_STAT [OK]</span><i /><i /><i /></div>

        <nav className="desktop-nav relative z-10 flex flex-wrap items-center justify-center gap-2" aria-label="Основная навигация">
          {navItems.map((item) => (
            <button
              key={item}
              className={`nav-button ${active === item ? 'is-active' : ''}`}
              onClick={() => setActive(item)}
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
            {navItems.map((item) => (
              <button key={item} className={active === item ? 'is-active' : ''} onClick={() => { setActive(item); setMobileOpen(false) }} type="button">
                {item}
              </button>
            ))}
          </nav>
        )}
      </section>

      {/* Выводим плашку каталога строго в этой контентной области */}
      <section className="content-placeholder" aria-label="Основная область страницы">
        {active === 'ARCHIVE' && <ArchivePage />}
      </section>

      <footer className="site-footer relative z-10">
        <div className="footer-contacts">
          <a href="https://t.me" target="_blank" rel="noreferrer"><Send size={19} strokeWidth={1.7} /><span>@Le_Pukich</span></a>
          <a href="mailto:kk5086617@gmail.com"><Mail size={19} strokeWidth={1.7} /><span>kk5086617@gmail.com</span></a>
          <a href="tel:+79133817248"><Phone size={19} strokeWidth={1.7} /><span>+7 (913) 381-72-48</span></a>
        </div>
      </footer>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
