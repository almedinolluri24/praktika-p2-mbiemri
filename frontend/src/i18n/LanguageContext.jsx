import { useCallback, useEffect, useMemo, useState } from 'react'
import { LanguageContext } from './language-context.js'

const albanianTranslations = {
  'Could not place your pickup order.': 'Porosia për marrje nuk mund të dërgohej.',
  'Could not load the restaurant catalog. Make sure the Laravel server is running.': 'Katalogu i restoranteve nuk mund të ngarkohej. Sigurohuni që serveri Laravel është duke punuar.',
  'Could not start a secure login session. Please try again.': 'Nuk mund të niste një sesion i sigurt kyçjeje. Ju lutem provoni përsëri.',
  'Login failed. Please try again.': 'Kyçja dështoi. Ju lutem provoni përsëri.',
  'Registration failed. Please try again.': 'Regjistrimi dështoi. Ju lutem provoni përsëri.',
  'Could not check the login session.': 'Nuk mund të verifikohej sesioni i kyçjes.',
  'Could not log out. Please try again.': 'Dalja nga llogaria dështoi. Ju lutem provoni përsëri.',
  'Manager request failed.': 'Kërkesa e menaxherit dështoi.',
  Italian: 'Italiane',
  Burgers: 'Hamburgerë',
  Traditional: 'Tradicionale',
  Cafe: 'Kafe',
  Bakery: 'Furrë',
  Desserts: 'Ëmbëlsira',
  Healthy: 'E shëndetshme',
  Pizza: 'Pica',
  Pasta: 'Makarona',
  Bowls: 'Tasa',
  Tacos: 'Tako',
  Sides: 'Shoqëruese',
  Sushi: 'Sushi',
  'Healthy bowls': 'Tasa të shëndetshëm',
  'fast food': 'Ushqim i shpejtë',
  'traditional restaurant': 'Restorant tradicional',
  'sweet shop': 'Ëmbëltore',
  'healthy kitchen': 'Kuzhinë e shëndetshme',
  pizzeria: 'Pizzeri',
  bakery: 'Furrë buke',
  cafe: 'Kafene',
  administrator: 'Administrator',
  customer: 'Klient',
  'restaurant manager': 'Menaxher Restoranti',
  'kitchen worker': 'Punonjës Kuzhine',
  'pickup worker': 'Sporteli i Marrjes',
  'pending_confirmation': 'Në pritje',
  confirmed: 'E pranuar',
  preparing: 'Në përgatitje',
  ready: 'Gati për marrje',
  picked_up: 'E përfunduar',
  cancelled: 'E anuluar',
  rejected: 'E refuzuar',
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('foodora_language')
    return ['sq', 'en', 'de'].includes(saved) ? saved : 'sq'
  })
  const [germanTranslations, setGermanTranslations] = useState({})
  const [englishTranslations, setEnglishTranslations] = useState({})

  useEffect(() => {
    if (language !== 'de') return undefined
    let active = true
    import('./german-translations.js').then(({ default: translations }) => {
      if (active) setGermanTranslations(translations)
    })
    return () => { active = false }
  }, [language])

  useEffect(() => {
    if (language !== 'en') return undefined
    let active = true
    import('./english-translations.js').then(({ default: translations }) => {
      if (active) setEnglishTranslations(translations)
    })
    return () => { active = false }
  }, [language])

  useEffect(() => {
    document.documentElement.lang = language
    document.title = language === 'en'
      ? 'Foodora — Your Food. Your Time.'
      : language === 'de'
        ? 'Foodora — Dein Essen. Deine Zeit.'
        : 'Foodora — Ushqimi Yt. Koha Jote.'
  }, [language])

  const changeLanguage = useCallback((next) => {
    if (!['sq', 'en', 'de'].includes(next)) return
    localStorage.setItem('foodora_language', next)
    setLanguage(next)
  }, [])

  const t = useCallback((text, values = {}) => {
    const translated = language === 'en'
      ? englishTranslations[text] || text
      : language === 'de'
        ? germanTranslations[text] || englishTranslations[text] || text
        : albanianTranslations[text] || text
    return translated.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`)
  }, [language, germanTranslations, englishTranslations])

  const contextValue = useMemo(() => ({ language, changeLanguage, toggleLanguage: () => changeLanguage(language === 'sq' ? 'en' : 'sq'), t }), [language, changeLanguage, t])

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>
}
