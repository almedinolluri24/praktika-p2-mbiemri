import { useLanguage } from './useLanguage.js'

const languages = [
  { code: 'sq', label: 'SQ', name: 'Shqip' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
]

export function LanguageToggle() {
  const { language, changeLanguage, t } = useLanguage()

  return (
    <div className="language-toggle-btn" role="group" aria-label={t('Zgjidh gjuhën')}>
      {languages.map(({ code, label, name }) => (
        <button
          key={code}
          type="button"
          className={language === code ? 'current' : ''}
          onClick={() => changeLanguage(code)}
          aria-label={name}
          aria-pressed={language === code}
          title={name}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
