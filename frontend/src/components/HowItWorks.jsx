import { useLanguage } from '../i18n/useLanguage.js'

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function FoodMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Z" />
      <path d="M21 15v7" />
    </svg>
  )
}

function StorePickupIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
    </svg>
  )
}

const steps = [
  {
    number: '01',
    renderIcon: () => <SearchIcon />,
    title: 'Zgjidhni restorantin',
    description: 'Eksploroni pikat lokale më të mira dhe zgjidhni menynë që dëshironi.',
  },
  {
    number: '02',
    renderIcon: () => <FoodMenuIcon />,
    title: 'Përzgjidhni ushqimin',
    description: 'Konfiguroni pjatat me opsione, shtesa dhe shënime sipas dëshirës suaj.',
  },
  {
    number: '03',
    renderIcon: () => <StorePickupIcon />,
    title: 'Merrni porosinë në sportel',
    description: 'Shkoni te dega sapo porosia të jetë gati, tregoni kodin/QR dhe tërhiqeni menjëherë.',
  },
]

export function HowItWorks() {
  const { t } = useLanguage()
  return (
    <section className="how-section" id="how-it-works">
      <div className="section centered-heading">
        <span className="section-kicker">{t('TRE HAPA TË THJESHTË')}</span>
        <h2>{t('Ushqim i shijshëm,')} <span>{t('pa pritje në radhë')}</span></h2>
        <p>{t('Porositja dhe marrja e ushqimit nuk ka qenë kurrë më e lehtë dhe më e shpejtë.')}</p>
        <div className="steps-grid">
          {steps.map((step) => (
            <article className="step-card" key={step.number}>
              <span className="step-number">{step.number}</span>
              <span className="step-icon" aria-hidden="true">{step.renderIcon()}</span>
              <h3>{t(step.title)}</h3>
              <p>{t(step.description)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

