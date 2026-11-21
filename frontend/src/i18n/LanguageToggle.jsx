import { useEffect, useRef, useState } from 'react'
import { useLanguage } from './useLanguage.js'

const languages = [
  { code: 'sq', label: 'SQ', name: 'Shqip' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
]

export function LanguageToggle() {
  const { language, changeLanguage, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const pickerRef = useRef(null)
  const selectedLanguage = languages.find((item) => item.code === language) || languages[0]

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!pickerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [])

  return (
    <div className="language-picker" ref={pickerRef} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }}>
      <button
        type="button"
        className="language-picker-trigger"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-label={t('Zgjidh gjuhën')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
        <span className="language-picker-current">{selectedLanguage.label}</span>
        <svg className={`language-picker-chevron ${open ? 'open' : ''}`} viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="language-picker-menu" role="menu" aria-label={t('Zgjidh gjuhën')}>
          {languages.map(({ code, label, name }) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              className={language === code ? 'selected' : ''}
              onClick={() => { changeLanguage(code); setOpen(false) }}
              aria-checked={language === code}
            >
              <span>{name}</span>
              <span className="language-picker-code">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
