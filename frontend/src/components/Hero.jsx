import { useLanguage } from '../i18n/useLanguage.js'

export function Hero({ search, onSearch }) {
  const { t } = useLanguage()
  return (
    <section className="hero" id="home">
      <div className="hero-content">
        <span className="hero-eyebrow">
          <span className="eyebrow-dot"></span> {t('USHQIMI YT · KOHA JOTE')}
        </span>
        <h1>
          {t('Ushqimi juaj i preferuar,')}<br />
          <span>{t('gati për marrje')}</span>
        </h1>
        <p>
          {t('Zbuloni restorantet më të mira të qytetit, porositni ushqim të freskët dhe tërhiqeni sapo të jetë gati pa pritur në radhë.')}
        </p>
        <form
          className="hero-search"
          onSubmit={(event) => {
            event.preventDefault()
            document.querySelector('#restaurants')?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 5 5" />
          </svg>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={t('Kërkoni restorante, pica, hamburgerë, sallata...')}
            aria-label={t('Kërkoni restorante ose ushqime')}
          />
          <button type="submit">
            {t('Eksploro restorantet')} <span aria-hidden="true">→</span>
          </button>
        </form>
        <div className="hero-proof">
          <p><strong>{t('Porositni online')}</strong> {t('dhe merreni në restorant')}</p>
          <span className="proof-rating"><span>✓</span> {t('Pagesa bëhet në marrje')}</span>
        </div>
      </div>
      <div className="hero-art">
        <div className="hero-art-backdrop"></div>
        <img
          src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1050&q=85"
          alt={t('Ushqim i freskët dhe i shijshëm gati për marrje')}
        />
        <div className="pickup-badge">
          <span className="badge-icon">✓</span>
          <span>
            <strong>{t('I freskët & gati')}</strong>
            <small>{t('Përgatitur enkas për ju')}</small>
          </span>
        </div>
        <div className="hero-caption">
          <span className="caption-star">★</span>
          <span>
            <strong>{t('Shije të shkëlqyera, më afër')}</strong>
            <small>{t('Zgjidhni dhe tërhiqni kur dëshironi')}</small>
          </span>
        </div>
      </div>
    </section>
  )
}
