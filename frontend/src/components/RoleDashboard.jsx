import { useCallback, useEffect, useState } from 'react'
import { prepareCsrf, readCsrfCookie } from '../services/auth.js'
import { subscribeToOrderUpdates } from '../services/realtime.js'
import { ManagerTools } from './ManagerTools.jsx'
import { PickupScanner } from './PickupScanner.jsx'
import { FoodoraLogo } from './FoodoraLogo.jsx'
import { LanguageToggle } from '../i18n/LanguageToggle.jsx'
import { useLanguage } from '../i18n/useLanguage.js'
import {
  AlertTriangleIcon,
  BackArrowIcon,
  CheckCircleIcon,
  LogoutIcon,
  MoonIcon,
  NoteIcon,
  RefreshCwIcon,
  SunIcon,
} from './Icons.jsx'

const labels = {
  pending_confirmation: 'Në pritje',
  confirmed: 'E pranuar',
  preparing: 'Në përgatitje',
  ready: 'Gati për marrje',
  picked_up: 'E përfunduar',
  cancelled: 'E anuluar',
  rejected: 'E refuzuar',
}

async function api(url, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    await prepareCsrf()
    headers['X-XSRF-TOKEN'] = readCsrfCookie()
  }
  const response = await fetch(url, { method, credentials: 'include', headers, ...(body ? { body: JSON.stringify(body) } : {}) })
  const result = await response.json()
  if (!response.ok) throw new Error(Object.values(result.errors || {}).flat()[0] || result.message || 'Kërkesa nuk mund të përfundonte.')
  return result
}

export function RoleDashboard({ user, theme, onToggleTheme, onLogout, onClose }) {
  const { t, language } = useLanguage()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyOrder, setBusyOrder] = useState(null)
  const [error, setError] = useState('')
  const [reason, setReason] = useState({})
  const [eta, setEta] = useState({})
  const [tokens, setTokens] = useState({})
  const [activeTab, setActiveTab] = useState('orders')
  const [stationFilter, setStationFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [liveState, setLiveState] = useState('connecting')
  const receivePickupCode = useCallback((orderId, token) => setTokens((current) => ({ ...current, [orderId]: token })), [])
  const role = user.role
  const manager = role === 'restaurant_manager'
  const kitchen = role === 'kitchen_worker'
  const pickup = role === 'pickup_worker'
  const canManagePreparation = manager || kitchen

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const url = kitchen
        ? (stationFilter !== 'all' ? `/api/kitchen/queue?station=${stationFilter}` : '/api/kitchen/queue')
        : '/api/orders?per_page=50'
      const result = await api(url)
      let rows = result.data || []
      if (pickup) {
        rows = rows.filter((order) => order.status === 'ready')
      } else if (kitchen && statusFilter !== 'all') {
        rows = rows.filter((order) => order.status === statusFilter)
      }
      setOrders(rows)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [kitchen, pickup, stationFilter, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    let active = true
    let leaveChannels = () => {}
    const timer = window.setTimeout(() => {
      subscribeToOrderUpdates(user, () => { if (active) refresh() }, setLiveState).then((cleanup) => {
        if (active) leaveChannels = cleanup
        else cleanup()
      })
    }, 0)
    return () => { active = false; window.clearTimeout(timer); leaveChannels() }
  }, [refresh, user])

  async function act(orderId, action) {
    setBusyOrder(orderId)
    setError('')
    try {
      await action()
      await refresh()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusyOrder(null)
    }
  }

  async function transition(order, status) {
    const defaultEta = Math.max(...(order.items?.map((i) => i.prep_minutes || 15) || [15])) + 5
    const payload = { status }
    if (status === 'confirmed') payload.eta_minutes = Number(eta[order.id] || defaultEta)
    if (status === 'rejected' || (status === 'cancelled' && order.status !== 'pending_confirmation')) payload.reason = reason[order.id]?.trim()
    await api(`/api/orders/${order.id}/status`, { method: 'PATCH', body: payload })
  }

  const roleTitle = manager ? 'Paneli i Menaxherit' : kitchen ? 'Ekrani i Kuzhinës' : 'Sporteli i Marrjes (Pickup)'
  const roleSubtitle = manager
    ? 'Menaxhimi operativ i porosive, menusë, orarit, kapacitetit dhe raporteve të shitjeve.'
    : kitchen
    ? 'Përgatitja sipas stacioneve, përfundimi i artikujve, paketimi dhe afatet në kohë reale.'
    : 'Verifikimi i sigurt i kodit/QR dhe regjistrimi i pagesës me para në dorë.'
  const queueTitle = pickup ? 'Gati për marrje' : kitchen ? 'Radha e kuzhinës' : 'Porositë aktive'
  const queueDescription = pickup
    ? 'Porositë e përfunduara që presin tërheqjen nga klienti.'
    : kitchen
    ? 'Porositë aktive sipas stacionit dhe statusit të përgatitjes.'
    : 'Porositë e reja dhe ato që po përgatiten në filial.'

  return (
    <div className={`portal-page role-portal-page ${theme === 'dark' ? 'dark-theme' : ''}`}>
      {/* Top Fixed Operations Bar */}
      <header className="portal-topbar">
        <div className="portal-brand-block">
          <FoodoraLogo />
          <span className={`portal-role-pill ${role}`}>
            {manager ? 'PORTAL MENAXHERI' : kitchen ? 'EKRANI I KUZHINËS' : 'SPORTELI I MARRJES'}
          </span>
          <div className="portal-live-indicator">
            <span className={`status-dot ${liveState === 'connected' ? 'online' : liveState === 'connecting' ? 'pending' : 'offline'}`} />
            <span>
              {liveState === 'connected' ? 'Lidhja live aktive' : liveState === 'connecting' ? 'Po lidhet…' : 'Jashtë linje'}
            </span>
          </div>
        </div>

        <div className="portal-actions-block">
          <LanguageToggle />
          {(!manager || activeTab === 'orders') && (
            <button className="portal-refresh-btn" onClick={refresh} disabled={loading} title={t('Rifresko të dhënat')}>
              <RefreshCwIcon size={14} />
              <span>{t(loading ? 'Po ngarkohet…' : 'Rifresko')}</span>
            </button>
          )}

          {onToggleTheme && (
            <button
              className="portal-theme-btn"
              onClick={onToggleTheme}
              title={t(theme === 'dark' ? 'Kalo në modalitet të ndritshëm' : 'Kalo në modalitet të errët')}
              aria-label={t('Ndrysho temën')}
            >
              {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
            </button>
          )}

          <button
            className="portal-logout-button portal-logout-icon"
            onClick={onLogout}
            title={t('Dil nga llogaria')}
            aria-label={t('Dil nga llogaria')}
          >
            <LogoutIcon size={15} />
            <span>{t('Dil nga llogaria')}</span>
          </button>

          {/* Dedicated Exit Button - only way to leave the dashboard */}
          <button className="portal-exit-button portal-exit-icon" onClick={onClose} title={t('Dil nga paneli dhe kthehu te ballina e dyqanit')} aria-label={t('Dil nga paneli dhe kthehu te ballina e dyqanit')}>
            <BackArrowIcon size={15} />
            <span>{t('Kthehu te Ballina')}</span>
          </button>
        </div>
      </header>

      {/* Main Portal View */}
      <main className="portal-main-container">
        <div className="portal-intro-banner">
          <div>
            <h2>{t(roleTitle)}</h2>
            <p>{t(roleSubtitle)}</p>
          </div>
          <div className="portal-user-meta">
            <span>{t('Përdoruesi aktiv:')} <strong>{user.name}</strong></span>
            <small>{user.email}</small>
          </div>
        </div>

        <section className="portal-workspace">
          {manager && (
            <nav className="manager-dashboard-tabs" aria-label={t('Ndarjet e menaxherit')}>
              {[
                ['orders', 'Porositë'],
                ['menu', 'Menyja & Çmimet'],
                ['hours', 'Orari & Kapaciteti'],
                ['staff', 'Stafi i Filialit'],
                ['reports', 'Raportet & Shitjet'],
              ].map(([key, tabLabel]) => (
                <button
                  key={key}
                  type="button"
                  className={activeTab === key ? 'active' : ''}
                  aria-pressed={activeTab === key}
                  onClick={() => setActiveTab(key)}
                >
                  {t(tabLabel)}
                </button>
              ))}
            </nav>
          )}

          {kitchen && (
            <div className="kitchen-filter-bar">
              <div className="kitchen-filter-group">
                <span className="filter-group-title">{t('Stacioni:')}</span>
                {['all', 'pizza', 'grill', 'oven', 'drinks', 'packaging'].map((station) => (
                  <button
                    key={station}
                    type="button"
                    className={`filter-chip ${stationFilter === station ? 'selected' : ''}`}
                    onClick={() => setStationFilter(station)}
                  >
                    {t(({ all: 'Të gjitha stacionet', pizza: 'Pica', grill: 'Zgarë', oven: 'Furrë', drinks: 'Pije', packaging: 'Paketim' })[station])}
                  </button>
                ))}
              </div>
              <div className="kitchen-filter-group ml-auto">
                <span className="filter-group-title">{t('Statusi:')}</span>
                {['all', 'confirmed', 'preparing'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`filter-chip ${statusFilter === st ? 'selected' : ''}`}
                    onClick={() => setStatusFilter(st)}
                  >
                    {t(st === 'all' ? 'Të gjitha' : labels[st] || st)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="admin-error" role="alert">
              <AlertTriangleIcon size={16} />
              <span>{t(error)}</span>
            </div>
          )}

          {manager && activeTab !== 'orders' ? (
            <ManagerTools section={activeTab} />
          ) : (
            <section className="portal-order-queue" aria-label={t(queueTitle)}>
              <div className="portal-section-heading">
                <div>
                  <h3>{t(queueTitle)}</h3>
                  <p>{t(queueDescription)}</p>
                </div>
                <span className="portal-order-count" aria-label={t('{count} porosi', { count: orders.length })}>
                  {orders.length}
                </span>
              </div>
              {loading && !orders.length ? (
                <div className="portal-loading-state" role="status">{t('Po ngarkohen porositë…')}</div>
              ) : !orders.length ? (
                <div className="orders-empty">
                  <h3>{t(pickup ? 'Nuk ka porosi gati për marrje tani' : 'Nuk ka porosi në radhë për këtë filial/stacion')}</h3>
                  <p>{t('Porositë e reja shfaqen automatikisht në kohë reale.')}</p>
                </div>
              ) : (
                <div className="role-order-list">
                  {orders.map((order) => {
                    const working = busyOrder === order.id
                    const allItemsDone = order.items?.every((item) => item.prep_status === 'completed')
                    const isDelayed = order.estimated_ready_at && new Date(order.estimated_ready_at) < new Date() && !['ready', 'picked_up'].includes(order.status)
                    const suggestedEta = Math.max(...(order.items?.map((i) => i.prep_minutes || 15) || [15])) + 5

                    return (
                      <article className="role-order-card" key={order.id}>
                        <div className="order-history-top">
                          <div>
                            <span>{t('POROSIA #{id}', { id: order.id })} · {order.branch?.restaurant?.name}</span>
                            <h3>{order.branch?.name} · {order.branch?.city}</h3>
                          </div>
                          <div className="order-top-right">
                            {isDelayed && (
                              <span className="order-delay-badge">
                                <AlertTriangleIcon size={12} />
                                <span>{t('Vonesë')}</span>
                              </span>
                            )}
                            <strong className={`order-status-pill ${order.status}`}>{t(labels[order.status] || order.status)}</strong>
                          </div>
                        </div>

                        <p className="role-order-customer">
                          {t('Klienti:')} <strong>{order.customer?.name || t('Klient')}</strong> · {t('Koha e marrjes:')} {new Date(order.pickup_at).toLocaleTimeString(language === 'en' ? 'en-US' : language === 'de' ? 'de-DE' : 'sq-XK', { hour: '2-digit', minute: '2-digit' })}
                          {order.estimated_ready_at && ` (${t('Afati i vlerësuar:')} ${new Date(order.estimated_ready_at).toLocaleTimeString(language === 'en' ? 'en-US' : language === 'de' ? 'de-DE' : 'sq-XK', { hour: '2-digit', minute: '2-digit' })})`}
                        </p>

                        {order.customer_note && (
                          <div className="role-order-note">
                            <NoteIcon size={15} />
                            <div>
                              <strong>{t('Shënim nga klienti:')}</strong> {order.customer_note}
                            </div>
                          </div>
                        )}

                        <ul className="order-lines">
                          {(order.items || []).map((item) => (
                            <li key={item.id}>
                              <span>
                                {item.quantity} × {item.product_name}
                                <small>{t(({ pizza: 'Pica', grill: 'Zgarë', oven: 'Furrë', drinks: 'Pije', packaging: 'Paketim' })[item.prep_station] || item.prep_station)} · {item.options?.map((option) => option.option_name).join(', ') || t('Standard')}</small>
                              </span>
                              <strong>€{Number(item.line_total).toFixed(2)}</strong>
                              {canManagePreparation && order.status === 'preparing' && (
                                <button
                                  type="button"
                                  className={item.prep_status === 'completed' ? 'btn-done' : 'btn-action'}
                                  disabled={working || item.prep_status === 'completed'}
                                  onClick={() => act(order.id, () => api(`/api/orders/${order.id}/items/${item.id}/complete`, { method: 'POST', body: {} }))}
                                >
                                  {item.prep_status === 'completed' ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <CheckCircleIcon size={13} /> {t('Përfunduar')}
                                    </span>
                                  ) : (
                                    t('Shëno gati')
                                  )}
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>

                        {manager && order.status === 'pending_confirmation' && (
                          <div className="role-action-row">
                            <label>
                              {t('Afati (minuta)')}
                              <input
                                type="number"
                                min="1"
                                max="240"
                                value={eta[order.id] || suggestedEta}
                                onChange={(event) => setEta((current) => ({ ...current, [order.id]: event.target.value }))}
                              />
                            </label>
                            <button disabled={working} onClick={() => act(order.id, () => transition(order, 'confirmed'))}>
                              {t('Prano porosinë')}
                            </button>
                            <input
                              aria-label={t('Arsyeja e refuzimit')}
                              placeholder={t('Arsyeja e refuzimit...')}
                              value={reason[order.id] || ''}
                              onChange={(event) => setReason((current) => ({ ...current, [order.id]: event.target.value }))}
                            />
                            <button className="btn-danger" disabled={working || !reason[order.id]?.trim()} onClick={() => act(order.id, () => transition(order, 'rejected'))}>
                              {t('Refuzo')}
                            </button>
                          </div>
                        )}

                        {canManagePreparation && order.status === 'confirmed' && (
                          <div className="role-action-row">
                            <button disabled={working} onClick={() => act(order.id, () => transition(order, 'preparing'))}>
                              {t('Fillo përgatitjen në kuzhinë')}
                            </button>
                          </div>
                        )}

                        {canManagePreparation && ['confirmed', 'preparing'].includes(order.status) && (
                          <div className="role-action-row">
                            <label>
                              {t('Përditëso afatin (min)')}
                              <input
                                type="number"
                                min="1"
                                max="240"
                                value={eta[order.id] || order.eta_minutes || suggestedEta}
                                onChange={(event) => setEta((current) => ({ ...current, [order.id]: event.target.value }))}
                              />
                            </label>
                            <input
                              aria-label={t('Arsyeja e ndryshimit të afatit')}
                              placeholder={t('Arsyeja e ndryshimit të afatit...')}
                              value={reason[order.id] || ''}
                              onChange={(event) => setReason((current) => ({ ...current, [order.id]: event.target.value }))}
                            />
                            <button
                              disabled={working || !reason[order.id]?.trim()}
                              onClick={() => act(order.id, () => api(`/api/orders/${order.id}/eta`, {
                                method: 'PATCH',
                                body: { eta_minutes: Number(eta[order.id] || order.eta_minutes || suggestedEta), reason: reason[order.id]?.trim() }
                              }))}
                            >
                              {t('Ruaj afatin')}
                            </button>
                          </div>
                        )}

                        {canManagePreparation && order.status === 'preparing' && (
                          <div className="role-action-row">
                            <button
                              disabled={working || !allItemsDone || Boolean(order.packaging_confirmed_at)}
                              onClick={() => act(order.id, () => api(`/api/orders/${order.id}/packaging-confirmed`, { method: 'POST', body: {} }))}
                            >
                              {order.packaging_confirmed_at ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <CheckCircleIcon size={14} /> {t('Paketimi i konfirmuar')}
                                </span>
                              ) : (
                                t('Konfirmo paketimin')
                              )}
                            </button>
                            <button
                              disabled={working || !allItemsDone || !order.packaging_confirmed_at}
                              onClick={() => act(order.id, () => transition(order, 'ready'))}
                            >
                              {t('Shëno: Gati për marrje')}
                            </button>
                          </div>
                        )}

                        {pickup && (
                          <div className="role-pickup-actions">
                            <p>
                              {t('Pagesa:')} <strong>€{Number(order.total).toFixed(2)}</strong> · {t(order.payment_status === 'paid' ? 'E paguar' : 'E papaguar (Para në dorë te sporteli)')}
                            </p>
                            {order.payment_status !== 'paid' ? (
                              <button disabled={working} onClick={() => act(order.id, () => api(`/api/orders/${order.id}/payment`, { method: 'POST', body: { amount: Number(order.total) } }))}>
                                {t('Regjistro pagesën me para në dorë')}
                              </button>
                            ) : (
                              <>
                                <PickupScanner orderId={order.id} onDetected={receivePickupCode} />
                                <label>
                                  {t('Kodi i marrjes nga klienti')}
                                  <input
                                    value={tokens[order.id] || ''}
                                    onChange={(event) => setTokens((current) => ({ ...current, [order.id]: event.target.value }))}
                                    placeholder={t('Shkruani kodin ose skanoni QR...')}
                                    autoComplete="off"
                                  />
                                </label>
                                <button disabled={working || !tokens[order.id]?.trim()} onClick={() => act(order.id, () => api(`/api/orders/${order.id}/pickup`, { method: 'POST', body: { pickup_token: tokens[order.id].trim() } }))}>
                                  {t('Verifiko & Konfirmo Marrjen')}
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        <footer className="order-total">
                          <span>{t(order.schedule_type === 'asap' ? 'Marrje ASAP' : 'Marrje e planifikuar')}</span>
                          <strong>{t('Totali')} €{Number(order.total).toFixed(2)}</strong>
                        </footer>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          )}
        </section>
      </main>
    </div>
  )
}
