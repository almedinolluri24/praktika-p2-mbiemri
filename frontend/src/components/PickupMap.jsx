import { useMemo, useState } from 'react'
import { useLanguage } from '../i18n/useLanguage.js'
import './PickupMap.css'

export function PickupMap({ restaurants, cityFilter }) {
  const { t } = useLanguage()
  const locations = useMemo(() => restaurants.flatMap((restaurant) =>
    (restaurant.branches || []).map((branch) => ({ restaurant, branch })),
  ), [restaurants])
  const visibleLocations = cityFilter === 'All'
    ? locations
    : locations.filter(({ branch }) => branch.city === cityFilter)
  const [selectedKey, setSelectedKey] = useState('')
  const selected = visibleLocations.find(({ restaurant, branch }) => `${restaurant.id}-${branch.id}` === selectedKey) || visibleLocations[0]
  const mapQuery = selected ? `${selected.branch.address}, ${selected.branch.city}` : 'Prishtina, Kosovo'
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`
  const directionsUrl = selected
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.branch.address}, ${selected.branch.city}`)}`
    : 'https://www.google.com/maps/search/?api=1&query=restaurants+in+Prishtina'

  if (!restaurants.length) return null

  return (
    <section className="pickup-map-section" aria-labelledby="pickup-map-title">
      <div className="pickup-map-heading">
        <div>
          <span className="section-kicker">{t('GJEJI AFËR TEJE')}</span>
          <h3 id="pickup-map-title">{t('Pikat e marrjes në hartë')}</h3>
          <p>{t('Zgjidh restorantin dhe shiko ku mund ta marrësh porosinë.')}</p>
        </div>
        <span className="pickup-map-count">{visibleLocations.length} {t('pika')}</span>
      </div>
      <div className="pickup-map-layout">
        <div className="pickup-location-list" aria-label={t('Pikat e marrjes')}>
          {visibleLocations.length ? visibleLocations.map(({ restaurant, branch }) => {
            const key = `${restaurant.id}-${branch.id}`
            const active = selected && selected.restaurant.id === restaurant.id && selected.branch.id === branch.id
            return (
              <button
                type="button"
                key={key}
                className={`pickup-location${active ? ' active' : ''}`}
                onClick={() => setSelectedKey(key)}
                aria-pressed={Boolean(active)}
              >
                <span className="pickup-location-pin" aria-hidden="true">⌖</span>
                <span className="pickup-location-copy">
                  <strong>{restaurant.name}</strong>
                  <small>{branch.address}, {branch.city}</small>
                </span>
                <span className="pickup-location-arrow" aria-hidden="true">→</span>
              </button>
            )
          }) : <p className="pickup-map-empty">{t('Nuk ka pika marrjeje në këtë qytet.')}</p>}
        </div>
        <div className="pickup-map-frame-wrap">
          <iframe
            key={mapQuery}
            title={t('Harta e pikës së marrjes')}
            src={mapUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          {selected && (
            <a className="pickup-map-open" href={directionsUrl} target="_blank" rel="noreferrer">
              <span aria-hidden="true">↗</span> {t('Hap udhëzimet')}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
