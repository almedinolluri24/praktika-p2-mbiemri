import { FoodoraLogo } from './FoodoraLogo.jsx'
import { useLanguage } from '../i18n/useLanguage.js'

export function Footer() {
  const { t } = useLanguage()
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-column">
          <a href="#home" className="brand-link" aria-label={`Foodora ${t('Ballina')}`}>
            <FoodoraLogo />
          </a>
          <p>
            {t('Ushqimi Yt. Koha Jote. Zbuloni ushqimet e preferuara lokale dhe tërhiqini të freskëta sipas orarit tuaj.')}
          </p>
        </div>
        <div className="footer-links">
          <h3>{t('Eksploro')}</h3>
          <a href="#home">{t('Ballina')}</a>
          <a href="#restaurants">{t('Restorantet')}</a>
          <a href="#popular-food">{t('Menyja')}</a>
          <a href="#how-it-works">{t('Si funksionon')}</a>
        </div>
        <div className="footer-links">
          <h3>{t('Kontakt & Lokacioni')}</h3>
          <a href="mailto:info@foodora.demo">info@foodora.demo</a>
          <a href="tel:+38344123456">+383 (0) 44 123 456</a>
          <span>{t('Prishtinë, Kosovë')}</span>
        </div>
        <div className="footer-newsletter">
          <h3>{t('Foodora Kosovë')}</h3>
          <p>{t('Platformë për porositjen dhe marrjen e ushqimit në restorante lokale.')}</p>
          <a href="#restaurants">
            {t('Porosit tani')} <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Foodora. {t('Të gjitha të drejtat të rezervuara.')}</span>
        <span>{t('Ushqimi Yt. Koha Jote. Marrje në Restorant.')}</span>
      </div>
    </footer>
  )
}
