import { useEffect, useState } from 'react'
import { PickupQr } from './PickupQr.jsx'
import { useLanguage } from '../i18n/useLanguage.js'
import { LanguageToggle } from '../i18n/LanguageToggle.jsx'

function localDate(date) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const firstScheduledDate = localDate(new Date(Date.now() + 86_400_000))
const earliestDate = localDate(new Date())
const latestDate = localDate(new Date(Date.now() + 14 * 86_400_000))

export function CartDrawer({
  open,
  items,
  total,
  onClose,
  onUpdateQuantity,
  onCheckout,
  checkingOut,
  checkoutError,
  confirmation,
  canCheckout,
  priceReview,
  onConfirmPrice,
}) {
  const { t } = useLanguage()
  const [scheduleType, setScheduleType] = useState('asap')
  const [selectedDate, setSelectedDate] = useState(firstScheduledDate)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const branchId = items[0]?.branchId

  useEffect(() => {
    if (!open || scheduleType !== 'scheduled' || !branchId) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSlotsLoading(true)
      setSlotsError('')
      fetch(`/api/branches/${branchId}/pickup-slots?date=${selectedDate}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
        .then(async (response) => {
          const result = await response.json()
          if (!response.ok) throw new Error(result.message || 'Nuk mund të ngarkohen oraret e marrjes.')
          return result.slots || []
        })
        .then((availableSlots) => {
          setSlots(availableSlots)
          setSelectedSlot((current) =>
            availableSlots.some((slot) => slot.pickup_at === current) ? current : availableSlots[0]?.pickup_at || ''
          )
        })
        .catch((error) => {
          if (error.name !== 'AbortError') setSlotsError(error.message)
        })
        .finally(() => {
          if (!controller.signal.aborted) setSlotsLoading(false)
        })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, scheduleType, branchId, selectedDate])

  if (!open) return null

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="drawer-header">
          <div>
            <span className="section-kicker">{t('POROSIA JUAJ ME MARRJE')}</span>
            <h2 id="cart-title">
              {t(confirmation ? 'Porosia u krye me sukses' : 'Shporta juaj')}{' '}
              <span>({totalCount} {t(totalCount === 1 ? 'artikull' : 'artikuj')})</span>
            </h2>
          </div>
          <div className="drawer-header-actions">
            <LanguageToggle />
            <button className="drawer-close" onClick={onClose} aria-label={t('Mbyll shportën')}>
              ×
            </button>
          </div>
        </div>

        {confirmation ? (
          <div className="cart-confirmation">
            <span className="confirmation-check" aria-hidden="true">✓</span>
            <h3>{t('Porosia juaj është në radhën e restorantit!')}</h3>
            <p>{t('Porosia #{id}', { id: confirmation.order.id })} · {t('Pagesë me para në dorë në marrje (Cash)')}</p>
            <div className="pickup-token">
              <PickupQr value={confirmation.pickup_token} />
              <small>{t('KODI NJËPËRDORIMËSH I MARRJES')}</small>
              <strong>{confirmation.pickup_token}</strong>
              <span>{t('Paraqisni këtë kod ose QR te stafi i restorantit për ta marrë porosinë tuaj.')}</span>
            </div>
            <button className="checkout-placeholder" onClick={onClose}>
              {t('Përfundo dhe Kthehu te Ballina')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="cart-empty">
            <span className="empty-bag" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none">
                <path d="M5 7h3l2.4 13.1a2 2 0 0 0 2 1.6h11.2a2 2 0 0 0 1.9-1.5L28 11H9" />
                <path d="M12 25.5h.1M23 25.5h.1" />
              </svg>
            </span>
            <h3>{t('Shporta juaj është e zbrazët')}</h3>
            <p>{t('Shtoni pjata të shijshme nga restorantet lokale për të filluar porosinë tuaj.')}</p>
            <button onClick={onClose}>{t('Eksploro ushqimet')}</button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map((item) => (
                <div className="cart-item" key={item.id}>
                  <img
                    src={
                      item.image?.startsWith('http') || item.image?.startsWith('/')
                        ? item.image
                        : `https://images.unsplash.com/${item.image}?auto=format&fit=crop&w=180&q=70`
                    }
                    alt={item.name}
                  />
                  <div className="cart-item-details">
                    <strong>{item.name}</strong>
                    <small>{item.restaurantName}</small>
                    {item.selectedOptionNames?.length > 0 && (
                      <small className="cart-options-detail">
                        {item.selectedOptionNames.join(', ')}
                      </small>
                    )}
                    <b>€{((item.price + item.optionExtra) * item.quantity).toFixed(2)}</b>
                  </div>
                  <div className="quantity-control">
                    <button onClick={() => onUpdateQuantity(item.id, -1)} aria-label={t('Hiq një {name}', { name: item.name })}>
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button onClick={() => onUpdateQuantity(item.id, 1)} aria-label={t('Shto një {name}', { name: item.name })}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="drawer-summary">
              <p>
                <span>{t('Nëntotali i artikujve')}</span>
                <strong>€{total.toFixed(2)}</strong>
              </p>

              <div className="pickup-schedule">
                <span className="schedule-title">🕒 {t('Koha e marrjes në restorant')}</span>
                <div className="schedule-switch">
                  <button
                    type="button"
                    aria-pressed={scheduleType === 'asap'}
                    className={scheduleType === 'asap' ? 'selected' : ''}
                    onClick={() => setScheduleType('asap')}
                  >
                    ⚡ {t('Sa më shpejt')} (ASAP)
                  </button>
                  <button
                    type="button"
                    aria-pressed={scheduleType === 'scheduled'}
                    className={scheduleType === 'scheduled' ? 'selected' : ''}
                    onClick={() => setScheduleType('scheduled')}
                  >
                    📅 {t('Zgjidhni orar')}
                  </button>
                </div>

                {scheduleType === 'scheduled' && (
                  <div className="slot-picker">
                    <label htmlFor="pickup-date">{t('Data e marrjes')}</label>
                    <input
                      id="pickup-date"
                      type="date"
                      value={selectedDate}
                      min={earliestDate}
                      max={latestDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                    />
                    {slotsLoading ? (
                      <small role="status">{t('Po ngarkohen oraret e disponueshme…')}</small>
                    ) : slotsError ? (
                      <small role="alert">{slotsError}</small>
                    ) : slots.length ? (
                      <>
                        <label htmlFor="pickup-slot">{t('Orari i disponueshëm')}</label>
                        <select
                          id="pickup-slot"
                          value={selectedSlot}
                          onChange={(event) => setSelectedSlot(event.target.value)}
                        >
                          {slots.map((slot) => (
                            <option key={slot.pickup_at} value={slot.pickup_at}>
                              {slot.label}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <small>{t('Nuk ka orare të lira për këtë datë.')}</small>
                    )}
                  </div>
                )}
              </div>

              <div className="cart-note-section">
                <label htmlFor="cart-customer-note">📝 {t('Shënime për stafin (alergji / preferenca përgatitjeje)')}</label>
                <textarea
                  id="cart-customer-note"
                  rows="2"
                  maxLength="1000"
                  placeholder={t('p.sh. Ju lutem pa qepë, salcën veçmas, alergji ndaj arrave...')}
                  value={customerNote}
                  onChange={(event) => setCustomerNote(event.target.value)}
                />
              </div>

              <p>
                <span>{t('Mënyra e pagesës')}</span>
                <strong>💵 {t('Para në dorë në marrje (Cash)')}</strong>
              </p>

              <div className="drawer-total">
                <span>{t('Totali për pagesë')}</span>
                <strong>€{total.toFixed(2)}</strong>
              </div>

              {priceReview && (
                <div className="price-review" role="alert">
                  <strong>⚠️ {t('Çmimet në meny kanë ndryshuar')}</strong>
                  <p>{t('Rishikoni artikujt e përditësuar. Porosia juaj nuk është dërguar ende.')}</p>
                  {priceReview.items?.map((line) => (
                    <small key={`${line.product_name}-${line.line_total}`}>
                      {line.quantity} × {line.product_name} · €{Number(line.line_total).toFixed(2)}
                    </small>
                  ))}
                  <div className="price-review-total">
                    <span>{t('Totali i përditësuar')}</span>
                    <b>€{Number(priceReview.total).toFixed(2)}</b>
                  </div>
                  <button type="button" onClick={onConfirmPrice} disabled={checkingOut}>
                    {t('Prano totalin e përditësuar')}
                  </button>
                </div>
              )}

              {checkoutError && <p className="checkout-error" role="alert">{t(checkoutError)}</p>}

              <button
                className="checkout-placeholder"
                onClick={() => onCheckout({ scheduleType, pickupAt: selectedSlot, customerNote })}
                disabled={
                  checkingOut ||
                  (scheduleType === 'scheduled' && (!selectedSlot || slotsLoading))
                }
              >
                {checkingOut ? t('Po dërgohet porosia…') : canCheckout ? t('Dërgo porosinë për marrje') : t('Kyçuni për të përfunduar porosinë')}{' '}
                <span>→</span>
              </button>

              <small className="demo-note">
                {t('Serveri rillogarit çmimet, opsionet dhe kapacitetin e intervalit në bazën e të dhënave para ruajtjes.')}
              </small>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
