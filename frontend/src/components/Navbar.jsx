import { useState } from 'react'
import { FoodoraLogo } from './FoodoraLogo.jsx'

export function Navbar({ cartCount, onOpenCart, onShowNotice }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return <header className="site-header"><div className="nav-wrap">
    <a href="#home" className="brand-link" onClick={closeMenu} aria-label="Foodora home"><FoodoraLogo /></a>
    <button className="mobile-menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen}><span></span><span></span><span></span></button>
    <nav className={menuOpen ? 'main-nav open' : 'main-nav'} aria-label="Main navigation"><a href="#home" onClick={closeMenu}>Home</a><a href="#restaurants" onClick={closeMenu}>Restaurants</a><a href="#how-it-works" onClick={closeMenu}>How it works</a></nav>
    <div className={menuOpen ? 'nav-actions open' : 'nav-actions'}><button className="login-button" onClick={() => { closeMenu(); onShowNotice('Login is a demo placeholder for this frontend.') }}>Login</button><button className="register-button" onClick={() => { closeMenu(); onShowNotice('Registration is a demo placeholder for this frontend.') }}>Register</button><button className="cart-trigger" onClick={() => { closeMenu(); onOpenCart() }} aria-label={`Open cart, ${cartCount} items`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><span className="cart-label">Cart</span>{cartCount > 0 && <span className="cart-count">{cartCount}</span>}</button></div>
  </div></header>
}
