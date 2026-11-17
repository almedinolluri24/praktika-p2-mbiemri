import { useLanguage } from '../i18n/useLanguage.js'
import './Hero.css'

export function Hero({ search, onSearch }) {
  const { t } = useLanguage()
  return (
    <section className="foodora-hero" id="home">
      <div className="foodora-hero-copy">
        <span className="foodora-hero-eyebrow">
          <span aria-hidden="true"></span> {t('USHQIMI YT · KOHA JOTE')}
        </span>
        <h1>
          {t('Ushqimi juaj i preferuar,')}
          <span>{t('gati për marrje')}</span>
        </h1>
        <p className="foodora-hero-description">
          {t('Zbuloni restorantet më të mira të qytetit, porositni ushqim të freskët dhe tërhiqeni sapo të jetë gati pa pritur në radhë.')}
        </p>
        <form
          className="foodora-hero-search"
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
        <div className="foodora-hero-benefits">
          <span><i aria-hidden="true">✓</i>{t('Marrje në restorant')}</span>
          <span><i aria-hidden="true">✓</i>{t('Pagesa në marrje')}</span>
        </div>
      </div>
      <div className="foodora-hero-visual">
        <img
          src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1050&q=85"
          alt={t('Ushqim i freskët dhe i shijshëm gati për marrje')}
        />
        <div className="foodora-hero-ready">
          <span className="foodora-hero-ready-icon" aria-hidden="true">✓</span>
          <span className="foodora-hero-badge-copy">
            <strong>{t('I freskët & gati')}</strong>
            <small>{t('Përgatitur enkas për ju')}</small>
          </span>
        </div>
        <div className="foodora-hero-caption">
          <span className="foodora-hero-caption-icon" aria-hidden="true">✦</span>
          <span className="foodora-hero-badge-copy">
            <strong>{t('Shije të shkëlqyera, më afër')}</strong>
            <small>{t('Zgjidhni dhe tërhiqni kur dëshironi')}</small>
          </span>
        </div>
      </div>
    </section>
  )
}
