import { useState } from 'react'
import { CalendarIcon, ClockIcon, InfoIcon, PhoneIcon, PinIcon } from './Icons.jsx'
import { useLanguage } from '../i18n/useLanguage.js'

const weekdays = ['E Diel', 'E Hënë', 'E Martë', 'E Mërkurë', 'E Enjte', 'E Premte', 'E Shtunë']

export function RestaurantProfile({ restaurant, selectedBranch, onSelectBranch, onBack }) {
  const { t } = useLanguage()
  const [showHours, setShowHours] = useState(false)
  if (!restaurant) return null

  const branches = restaurant.branches || []
  const branch = selectedBranch || branches[0]

  return (
    <section className="restaurant-profile-banner" aria-label={t('Profili i Restorantit')}>
      <div className="profile-header">
        <button className="profile-back-button" onClick={onBack} aria-label={t('Kthehu te restorantet')}>
          ← {t('Të gjithë restorantet')}
        </button>
        <div className="profile-titles">
          <div className="profile-badge-row">
            <span className="profile-cuisine-badge">{t(restaurant.cuisine)}</span>
            {branch?.isOpenNow ? (
              <span className="profile-open-badge">
                <span className="status-dot online" /> {t('Hapur tani')}
              </span>
            ) : (
              <span className="profile-closed-badge">
                <span className="status-dot offline" /> {t('Mbyllur tani')}
              </span>
            )}
          </div>
          <h2>{restaurant.name}</h2>
          <p>{restaurant.description}</p>
        </div>
      </div>

      <div className="profile-branch-box">
        <div className="profile-branch-selector">
          <label htmlFor="branch-picker">
            <strong>{t('Zgjidh filialin për marrje:')}</strong>
          </label>
          {branches.length > 1 ? (
            <select
              id="branch-picker"
              value={branch?.id || ''}
              onChange={(e) => {
                const target = branches.find((b) => b.id === Number(e.target.value))
                if (target) onSelectBranch(target)
              }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city}) {b.isOpenNow ? `— ${t('Hapur')}` : `— ${t('Mbyllur')}`}
                </option>
              ))}
            </select>
          ) : (
            <span className="single-branch-tag">{branch?.name || t('Filiali kryesor')}</span>
          )}
        </div>

        {branch && (
          <div className="profile-branch-details">
            <div className="branch-meta-item">
              <span className="meta-icon"><PinIcon size={16} /></span>
              <div>
                <small>{t('Adresa & Qyteti')}</small>
                <strong>{branch.address}, {branch.city}</strong>
              </div>
            </div>

            {branch.phone && (
              <div className="branch-meta-item">
                <span className="meta-icon"><PhoneIcon size={16} /></span>
                <div>
                  <small>{t('Kontakti')}</small>
                  <strong>{branch.phone}</strong>
                </div>
              </div>
            )}

            <div className="branch-meta-item">
              <span className="meta-icon"><ClockIcon size={16} /></span>
              <div>
                <small>{t('Koha mesatare e marrjes')}</small>
                <strong>{restaurant.pickup || '15–30 min'}</strong>
              </div>
            </div>

            {branch.pickupInstructions && (
              <div className="branch-meta-item full-width">
                <span className="meta-icon"><InfoIcon size={16} /></span>
                <div>
                  <small>{t('Udhëzimet e marrjes te sporteli')}</small>
                  <p>{branch.pickupInstructions}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {branch?.businessHours && branch.businessHours.length > 0 && (
          <div className="profile-hours-toggle">
            <button
              type="button"
              className="hours-button"
              onClick={() => setShowHours((prev) => !prev)}
              aria-expanded={showHours}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <CalendarIcon size={14} />
              <span>{t(showHours ? 'Fshih orarin e punës' : 'Shiko orarin javor të punës')}</span>
            </button>
            {showHours && (
              <div className="profile-hours-grid">
                {branch.businessHours
                  .sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7))
                  .map((h) => (
                    <div key={h.weekday} className={`hour-row ${h.is_closed ? 'closed' : ''}`}>
                      <span>{t(weekdays[h.weekday])}</span>
                      <strong>{h.is_closed ? t('Mbyllur') : `${h.opens_at?.slice(0, 5)} – ${h.closes_at?.slice(0, 5)}`}</strong>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
