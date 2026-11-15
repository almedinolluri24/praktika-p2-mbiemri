import { useLanguage } from './useLanguage.js'

export function LanguageToggle() {
  const { language, toggleLanguage, t } = useLanguage()
  const nextLanguage = language === 'sq' ? 'en' : 'sq'
  const switchLabel = t(language === 'sq' ? 'Kalo në anglisht' : 'Kalo në shqip')

  return (
    <button
      type="button"
      className="language-toggle-btn"
      onClick={toggleLanguage}
      aria-label={switchLabel}
      title={switchLabel}
    >
      <span className={language === 'sq' ? 'current' : ''}>SQ</span>
      <span aria-hidden="true">/</span>
      <span className={language === 'en' ? 'current' : ''}>EN</span>
      <span className="visually-hidden">{t(nextLanguage === 'en' ? 'Anglisht' : 'Shqip')}</span>
    </button>
  )
}
