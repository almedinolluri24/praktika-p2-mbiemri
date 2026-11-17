import { useCallback, useEffect, useState } from 'react'
import { subscribeToOrderUpdates } from '../services/realtime.js'
import { prepareCsrf, readCsrfCookie } from '../services/auth.js'
import { PickupQr } from './PickupQr.jsx'
import { LanguageToggle } from '../i18n/LanguageToggle.jsx'
import { useLanguage } from '../i18n/useLanguage.js'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CookingFlameIcon,
  RefreshCwIcon,
  ShoppingBagIcon,
  StarBadgeIcon,
  UsersIcon,
} from './Icons.jsx'

const statusSteps = [
  { key: 'pending_confirmation', label: 'Në pritje', icon: ClockIcon },
  { key: 'confirmed', label: 'E pranuar', icon: CheckCircleIcon },
  { key: 'preparing', label: 'Në përgatitje', icon: CookingFlameIcon },
  { key: 'ready', label: 'Gati', icon: ShoppingBagIcon },
  { key: 'picked_up', label: 'E përfunduar', icon: StarBadgeIcon },
]

function getStepIndex(status) {
  switch (status) {
    case 'pending_confirmation': return 0
    case 'confirmed': return 1
    case 'preparing': return 2
    case 'ready': return 3
    case 'picked_up': return 4
    default: return -1
  }
}

const statusBadgeLabels = {
  pending_confirmation: 'Në pritje',
  confirmed: 'E pranuar',
  preparing: 'Në përgatitje',
  ready: 'Gati për marrje',
  picked_up: 'E përfunduar',
  cancelled: 'E anuluar',
  rejected: 'E refuzuar',
}

function remainingTimeText(date, now, t) {
  if (!date) return t('Ende pa vlerësim afati nga restoranti')
  const seconds = Math.floor((new Date(date).getTime() - now) / 1000)
  if (seconds <= 0) return t('Afati i parashikuar ka kaluar; stafi po e përfundon')
  const minutes = Math.floor(seconds / 60)
  const remainingSec = seconds % 60
  return t('Edhe rreth {minutes} min {seconds} sek të mbetura', {
    minutes,
    seconds: String(remainingSec).padStart(2, '0'),
  })
}

export function OrdersPanel({ user, onClose, onProfileUpdated }) {
  const { t, language } = useLanguage()
  const [activeTab, setActiveTab] = useState('orders') // 'orders' | 'profile'
  const [orders, setOrders] = useState([])
  const [now, setNow] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [liveState, setLiveState] = useState('connecting')
  const [profileName, setProfileName] = useState(user.name)
  const [profileEmail, setProfileEmail] = useState(user.email)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/orders', { credentials: 'include', headers: { Accept: 'application/json' } })
      const page = await response.json()
      if (!response.ok) throw new Error(page.message || 'Porositë tuaja nuk mund të ngarkohen.')
      const details = await Promise.all(
        page.data.map(async (order) => {
          const detailResponse = await fetch(`/api/orders/${order.id}`, { credentials: 'include', headers: { Accept: 'application/json' } })
          const detail = await detailResponse.json()
          if (!detailResponse.ok) throw new Error(detail.message || `Porosia #${order.id} nuk mund të ngarkohej.`)
          return detail
        })
      )
      setOrders(details)
      setUpdatedAt(new Date())
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  async function saveProfile(event) {
    event.preventDefault()
    setProfileSaving(true)
    setError('')
    setProfileSuccess('')
    try {
      await prepareCsrf()
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': readCsrfCookie() },
        body: JSON.stringify({ name: profileName.trim(), email: profileEmail.trim() }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(Object.values(result.errors || {}).flat()[0] || result.message || 'Profili nuk u përditësua.')
      onProfileUpdated?.(result.user)
      setProfileSuccess('Profili juaj u ruajt me sukses.')
      window.setTimeout(() => setProfileSuccess(''), 3000)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setProfileSaving(false)
    }
  }

  async function cancelOrder(order) {
    if (!window.confirm(t('A jeni të sigurt që dëshironi të anuloni porosinë #{id}?', { id: order.id }))) return
    setError('')
    try {
      await prepareCsrf()
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': readCsrfCookie() },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(Object.values(result.errors || {}).flat()[0] || result.message || 'Porosia nuk mund të anulohej.')
      await loadOrders()
    } catch (cancelError) {
      setError(cancelError.message)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadOrders, 0)
    return () => window.clearTimeout(timer)
  }, [loadOrders])

  useEffect(() => {
    let active = true
    let leaveChannels = () => {}
    const timer = window.setTimeout(() => {
      subscribeToOrderUpdates(user, () => { if (active) loadOrders() }, setLiveState).then((cleanup) => {
        if (active) leaveChannels = cleanup
        else cleanup()
      })
    }, 0)
    return () => { active = false; window.clearTimeout(timer); leaveChannels() }
  }, [loadOrders, user])

  useEffect(() => {
    const initialTick = window.setTimeout(() => setNow(Date.now()), 0)
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { window.clearTimeout(initialTick); window.clearInterval(timer) }
  }, [])

  return (
    <div className="admin-backdrop" role="presentation">
      <section className="orders-panel foodora-orders-modal" role="dialog" aria-modal="true" aria-labelledby="orders-title">
        <header className="foodora-modal-header">
          <div>
            <span className="foodora-kicker">{t('LLOGARIA JUAJ')}</span>
            <h2 id="orders-title">{t('Porositë & Gjurmimi Live')}</h2>
            <div className="foodora-live-indicator">
              <span className={`status-dot ${liveState === 'connected' ? 'online' : liveState === 'connecting' ? 'pending' : 'offline'}`} />
              <span>
                {liveState === 'connected'
                  ? t('Përditësime në kohë reale aktive')
                  : liveState === 'connecting'
                  ? t('Po lidhet me serverin live…')
                  : t('Lidhja live jashtë linje — rifresko')}
              </span>
              {updatedAt && <small>· {t('Rifreskuar')}: {updatedAt.toLocaleTimeString(language === 'en' ? 'en-US' : 'sq-XK')}</small>}
            </div>
          </div>
          <div className="foodora-header-actions">
            <LanguageToggle />
            <button className="foodora-icon-btn" onClick={loadOrders} disabled={loading} title={t('Rifresko të dhënat')} aria-label={t('Rifresko')}>
              <RefreshCwIcon size={14} />
            </button>
            <button className="foodora-icon-btn close" onClick={onClose} aria-label={t('Mbyll')}>
              ×
            </button>
          </div>
        </header>

        <nav className="foodora-subtabs" aria-label={t('Ndarjet e panelit të klientit')}>
          <button
            type="button"
            className={activeTab === 'orders' ? 'active' : ''}
            onClick={() => setActiveTab('orders')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ShoppingBagIcon size={14} />
            <span>{t('Porositë e mia ({count})', { count: orders.length })}</span>
          </button>
          <button
            type="button"
            className={activeTab === 'profile' ? 'active' : ''}
            onClick={() => setActiveTab('profile')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <UsersIcon size={14} />
            <span>{t('Profili im')}</span>
          </button>
        </nav>

        {error && (
          <div className="foodora-alert error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangleIcon size={16} />
            <span>{t(error)}</span>
          </div>
        )}
        {profileSuccess && (
          <div className="foodora-alert success" role="status" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircleIcon size={16} />
            <span>{t(profileSuccess)}</span>
          </div>
        )}

        {activeTab === 'profile' ? (
          <form className="foodora-profile-box" onSubmit={saveProfile}>
            <h3>{t('Të dhënat e profilit')}</h3>
            <p>{t('Përditësoni emrin dhe email-in tuaj personal.')}</p>
            <div className="foodora-form-group">
              <label htmlFor="profile-name">{t('Emri dhe mbiemri')}</label>
              <input
                id="profile-name"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                maxLength="120"
                required
              />
            </div>
            <div className="foodora-form-group">
              <label htmlFor="profile-email">{t('Adresa e email-it')}</label>
              <input
                id="profile-email"
                type="email"
                value={profileEmail}
                onChange={(event) => setProfileEmail(event.target.value)}
                required
              />
            </div>
            <button className="foodora-btn-primary" disabled={profileSaving} style={{ marginTop: '12px' }}>
              {t(profileSaving ? 'Po ruhet…' : 'Ruaj ndryshimet')}
            </button>
          </form>
        ) : loading && !orders.length ? (
          <div className="foodora-loading-state" role="status">{t('Po ngarkohen porositë tuaja…')}</div>
        ) : orders.length ? (
          <div className="foodora-orders-list">
            {orders.map((order) => {
              const currentStepIndex = getStepIndex(order.status)
              const isTerminal = ['cancelled', 'rejected'].includes(order.status)
              const prepStart = order.status_history?.find((s) => s.to_status === 'preparing')
              const terminalReason = order.status_history?.find((s) => ['cancelled', 'rejected'].includes(s.to_status) && s.note)?.note

              return (
                <article className="foodora-order-card" key={order.id}>
                  {/* Top Bar */}
                  <div className="foodora-order-card-header">
                    <div className="order-meta-info">
                      <span className="order-id-tag">{t('POROSIA #{id}', { id: order.id })}</span>
                      <h3>{order.branch?.restaurant?.name || t('Restoranti')}</h3>
                      <p className="order-branch-sub">{order.branch?.name} · {order.branch?.city}</p>
                    </div>
                    <span className={`foodora-status-badge ${order.status}`}>
                      {t(statusBadgeLabels[order.status] || order.status)}
                    </span>
                  </div>

                  {/* foodora-Style Step Tracker */}
                  {!isTerminal && (
                    <div className="foodora-stepper-wrap" aria-label={t('Hapat e përgatitjes')}>
                      <div className="foodora-stepper-bar">
                        <div
                          className="foodora-stepper-progress"
                          style={{ width: `${(Math.max(0, currentStepIndex) / (statusSteps.length - 1)) * 100}%` }}
                        />
                        {statusSteps.map((step, idx) => {
                          const isDone = idx < currentStepIndex
                          const isCurrent = idx === currentStepIndex
                          const StepIcon = step.icon
                          return (
                            <div
                              key={step.key}
                              className={`foodora-step-node ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                            >
                              <div className="node-circle">
                                {isDone ? <CheckCircleIcon size={14} /> : <StepIcon size={14} />}
                              </div>
                              <span className="node-label">{t(step.label)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ETA & Live Status Banner */}
                  <div className={`foodora-eta-banner ${order.status}`}>
                    {order.status === 'pending_confirmation' ? (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <ClockIcon size={18} />
                        <div>
                          <strong>{t('Në pritje të konfirmimit nga restoranti')}</strong>
                          <p>{t('Porosia u dërgua me sukses. Prisni që stafi të konfirmojë afatin e marrjes.')}</p>
                        </div>
                      </div>
                    ) : order.status === 'ready' ? (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <ShoppingBagIcon size={18} />
                        <div>
                          <strong>{t("Porosia është gati për t'u marrë!")}</strong>
                          <p>{t('Paraqituni te sporteli i restorantit dhe tregoni kodin/QR më poshtë.')}</p>
                        </div>
                      </div>
                    ) : order.status === 'picked_up' ? (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <CheckCircleIcon size={18} />
                        <div>
                          <strong>{t('Porosia u përfundua me sukses')}</strong>
                          <p>{t('Faleminderit që porositët në Foodora. Ju bëftë mirë!')}</p>
                        </div>
                      </div>
                    ) : isTerminal ? (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <AlertTriangleIcon size={18} />
                        <div>
                          <strong>{t('Porosia është {status}', { status: t(statusBadgeLabels[order.status]) })}</strong>
                          {terminalReason && <p>{t('Arsyeja:')} {terminalReason}</p>}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="eta-highlight-row">
                          <span className="eta-badge">{t('AFATI I MARRJES')}</span>
                          <strong>{remainingTimeText(order.estimated_ready_at, now, t)}</strong>
                        </div>
                        <div className="eta-times-row">
                          <span>{t('Koha e parashikuar:')} <strong>{order.estimated_ready_at ? new Date(order.estimated_ready_at).toLocaleTimeString(language === 'en' ? 'en-US' : 'sq-XK') : t('Në pritje')}</strong></span>
                          <span>{t('Koha e kërkuar:')} <strong>{order.pickup_at ? new Date(order.pickup_at).toLocaleTimeString(language === 'en' ? 'en-US' : 'sq-XK') : t('Sa më shpejt')}</strong></span>
                          {prepStart && <span>{t('Filloi përgatitja:')} <strong>{new Date(prepStart.created_at).toLocaleTimeString(language === 'en' ? 'en-US' : 'sq-XK')}</strong></span>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pickup Code & QR Card */}
                  {order.pickup_token && order.status !== 'picked_up' && (
                    <div className="foodora-pickup-card">
                      <div className="pickup-qr-container">
                        <PickupQr value={order.pickup_token} />
                      </div>
                      <div className="pickup-info-container">
                        <span className="pickup-kicker">{t('KODI I MARRJES (NJËPËRDORIMËSH)')}</span>
                        <div className="pickup-code-box">
                          <code>{order.pickup_token}</code>
                        </div>
                        <p className="pickup-instruction-text">
                          {t('Paraqisni këtë kod ose QR te sporteli i marrjes për ta verifikuar dhe tërhequr porosinë.')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Branch & Pickup Details */}
                  <div className="foodora-order-info-grid">
                    <div className="info-cell">
                      <small>{t('Pika e marrjes')}</small>
                      <strong>{order.branch?.address}, {order.branch?.city}</strong>
                    </div>
                    {order.branch?.pickup_instructions && (
                      <div className="info-cell full">
                        <small>{t('Udhëzimet e restorantit për marrje')}</small>
                        <p>{order.branch.pickup_instructions}</p>
                      </div>
                    )}
                    {order.customer_note && (
                      <div className="info-cell full" style={{ background: '#fef3c7', borderRadius: '6px', padding: '6px 10px', color: '#92400e' }}>
                        <small>{t('Shënimi juaj për këtë porosi:')}</small>
                        <p>{order.customer_note}</p>
                      </div>
                    )}
                  </div>

                  {/* Items list */}
                  <ul className="foodora-order-items-list">
                    {(order.items || []).map((item) => (
                      <li key={item.id}>
                        <div className="item-title-col">
                          <strong>{item.quantity} × {item.product_name}</strong>
                          {item.options && item.options.length > 0 && (
                            <small>{item.options.map((opt) => opt.option_name).join(', ')}</small>
                          )}
                        </div>
                        <strong className="item-price">€{Number(item.line_total).toFixed(2)}</strong>
                      </li>
                    ))}
                  </ul>

                  {/* Order Footer & Actions */}
                  <div className="foodora-order-card-footer">
                    <div className="footer-total-box">
                      <span>{t(order.schedule_type === 'asap' ? 'Marrje e menjëhershme (ASAP)' : 'Marrje e planifikuar')}</span>
                      <strong>{t('Totali:')} €{Number(order.total).toFixed(2)}</strong>
                    </div>

                    <div className="footer-actions-box">
                      {order.status === 'pending_confirmation' && (
                        <button
                          type="button"
                          className="foodora-btn-cancel"
                          onClick={() => cancelOrder(order)}
                        >
                          {t('Anulo porosinë')}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="foodora-empty-orders">
            <ShoppingBagIcon size={44} />
            <h3>{t('Nuk keni ende asnjë porosi')}</h3>
            <p>{t('Eksploroni restorantet më të mira dhe porositni ushqim të freskët për marrje!')}</p>
            <button className="foodora-btn-primary" onClick={onClose}>
              {t('Shiko menynë')}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
