import { useState } from 'react'
import { FoodoraLogo } from './FoodoraLogo.jsx'
import { LanguageToggle } from '../i18n/LanguageToggle.jsx'
import { useLanguage } from '../i18n/useLanguage.js'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  )
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  )
}

export function Navbar({
  cartCount,
  onOpenCart,
  onOpenOrders,
  onShowNotice,
  onLogin,
  onRegister,
  onDashboard,
  user,
  theme,
  onToggleTheme,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { t } = useLanguage()
  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <div className="nav-wrap">
        <a href="#home" className="brand-link" onClick={closeMenu} aria-label={`Foodora ${t('Ballina')}`}>
          <FoodoraLogo />
        </a>

        <button
          className="mobile-menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={t(menuOpen ? 'Mbyll menynë e navigimit' : 'Hap menynë e navigimit')}
          aria-expanded={menuOpen}
        >
          <span></span><span></span><span></span>
        </button>

        <nav className={menuOpen ? 'main-nav open' : 'main-nav'} aria-label={t('Navigimi kryesor')}>
          <a href="#home" onClick={closeMenu}>{t('Ballina')}</a>
          <a href="#restaurants" onClick={closeMenu}>{t('Restorantet')}</a>
          <a href="#how-it-works" onClick={closeMenu}>{t('Si funksionon')}</a>
        </nav>

        <div className={menuOpen ? 'nav-actions open' : 'nav-actions'}>
          {user ? (
            <>
              <span
                className="user-greeting"
                role="img"
                aria-label={t('Llogaria e kyçur: {name}', { name: user.name })}
                title={user.name}
              >
                <UserIcon />
              </span>

              {user.role === 'customer' && (
                <button className="login-button orders-nav-btn dashboard-nav-btn" onClick={() => { closeMenu(); onOpenOrders() }}>
                  <OrdersIcon />
                  <span>{t('Porositë e mia')}</span>
                </button>
              )}

              {['administrator', 'restaurant_manager', 'kitchen_worker', 'pickup_worker'].includes(user.role) && (
                <button
                  className="login-button dashboard-nav-btn"
                  aria-label={t(user.role === 'administrator' ? 'Paneli i administratorit' : 'Paneli i stafit')}
                  onClick={() => { closeMenu(); onDashboard() }}
                >
                  {user.role !== 'administrator' && <DashboardIcon />}
                  <span>{t(user.role === 'administrator' ? 'Paneli Admin' : 'Paneli i Punës')}</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button className="login-button auth-nav-btn" onClick={() => { closeMenu(); onLogin() }}>
                <LoginIcon />
                <span>{t('Kyçu')}</span>
              </button>
              <button
                className="register-button"
                onClick={() => {
                  closeMenu()
                  if (onRegister) onRegister()
                  else onShowNotice(t('Regjistrimi nuk është i mundur momentalisht.'))
                }}
              >
                {t('Regjistrohu')}
              </button>
            </>
          )}

          <button
            type="button"
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Kalo në temën e çelët' : 'Kalo në temën e errët'}
            title={theme === 'dark' ? 'Kalo në temën e çelët' : 'Kalo në temën e errët'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          <LanguageToggle />

          <button
            className="cart-trigger"
            onClick={() => { closeMenu(); onOpenCart() }}
            aria-label={t('Hap shportën, {count} artikuj', { count: cartCount })}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6"/>
              <circle cx="10" cy="20" r="1"/>
              <circle cx="18" cy="20" r="1"/>
            </svg>
            <span className="cart-label">{t('Shporta')}</span>
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>
        </div>
      </div>
    </header>
  )
}
