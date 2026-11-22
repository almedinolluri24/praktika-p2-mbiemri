import { useCallback, useEffect, useState } from 'react'
import { prepareCsrf, readCsrfCookie } from '../services/auth.js'
import { FoodoraLogo } from './FoodoraLogo.jsx'
import { LanguageToggle } from '../i18n/LanguageToggle.jsx'
import { useLanguage } from '../i18n/useLanguage.js'
import {
  AlertTriangleIcon,
  BackArrowIcon,
  LogoutIcon,
  MoonIcon,
  RefreshCwIcon,
  ShieldIcon,
  StoreIcon,
  SunIcon,
  TagIcon,
  UsersIcon,
} from './Icons.jsx'

async function request(url, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    await prepareCsrf()
    headers['X-XSRF-TOKEN'] = readCsrfCookie()
  }
  const response = await fetch(url, { method, credentials: 'include', headers, ...(body ? { body: JSON.stringify(body) } : {}) })
  const result = await response.json()
  if (!response.ok) throw new Error(Object.values(result.errors || {}).flat()[0] || result.message || 'Kërkesa e administratorit dështoi.')
  return result
}

const restaurantStatusLabels = {
  approved: '✓ I miratuar',
  pending: 'Në pritje',
  rejected: 'Refuzuar',
  suspended: 'Pezulluar',
}

export function AdminPanel({ user, theme, onToggleTheme, onLogout, onClose }) {
  const { t } = useLanguage()
  const [restaurants, setRestaurants] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [restaurantSearch, setRestaurantSearch] = useState('')
  const [restaurantStatusFilter, setRestaurantStatusFilter] = useState('all')
  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [branches, setBranches] = useState([])
  const [staffAccounts, setStaffAccounts] = useState([])
  const [accounts, setAccounts] = useState([])
  const [accountSearch, setAccountSearch] = useState('')
  const [branchStaff, setBranchStaff] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [staffUserId, setStaffUserId] = useState('')
  const [staffRole, setStaffRole] = useState('restaurant_manager')
  const [managerName, setManagerName] = useState('')
  const [managerEmail, setManagerEmail] = useState('')
  const [managerRestaurantIds, setManagerRestaurantIds] = useState([])
  const [managerCreatedMessage, setManagerCreatedMessage] = useState('')

  const loadRestaurants = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await request('/api/admin/restaurants?per_page=50')
      setRestaurants(result.data)
      setSelectedId((current) => current || result.data[0]?.id || null)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCategories = useCallback(async (restaurantId) => {
    if (!restaurantId) return
    try {
      const result = await request(`/api/admin/restaurants/${restaurantId}/categories`)
      setCategories(result.data)
    } catch (loadError) {
      setError(loadError.message)
    }
  }, [])

  const loadStaffData = useCallback(async () => {
    try {
      const [branchResult, accountResult, allAccountsResult] = await Promise.all([
        request('/api/admin/branches'),
        request('/api/admin/staff-accounts'),
        request('/api/admin/users?per_page=100'),
      ])
      setBranches(branchResult.data)
      setStaffAccounts(accountResult.data)
      setAccounts(allAccountsResult.data)
      setSelectedBranchId((current) => current || String(branchResult.data[0]?.id || ''))
    } catch (loadError) {
      setError(loadError.message)
    }
  }, [])

  const loadBranchStaff = useCallback(async (branchId) => {
    if (!branchId) return
    try {
      const result = await request(`/api/admin/branches/${branchId}/staff`)
      setBranchStaff(result.data)
    } catch (loadError) {
      setError(loadError.message)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadRestaurants, 0)
    return () => window.clearTimeout(timer)
  }, [loadRestaurants])

  useEffect(() => {
    const timer = window.setTimeout(loadStaffData, 0)
    return () => window.clearTimeout(timer)
  }, [loadStaffData])

  useEffect(() => {
    const timer = window.setTimeout(() => loadCategories(selectedId), 0)
    return () => window.clearTimeout(timer)
  }, [loadCategories, selectedId])

  useEffect(() => {
    const timer = window.setTimeout(() => loadBranchStaff(selectedBranchId), 0)
    return () => window.clearTimeout(timer)
  }, [loadBranchStaff, selectedBranchId])

  async function assignStaff(event) {
    event.preventDefault()
    if (!staffUserId || !selectedBranchId) return
    setBusy(true)
    setError('')
    try {
      await request(`/api/admin/branches/${selectedBranchId}/staff`, { method: 'POST', body: { user_id: Number(staffUserId), role: staffRole } })
      setStaffUserId('')
      await Promise.all([loadBranchStaff(selectedBranchId), loadStaffData()])
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function createManager(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setManagerCreatedMessage('')
    try {
      const result = await request('/api/admin/managers', {
        method: 'POST',
        body: { name: managerName, email: managerEmail, restaurant_ids: managerRestaurantIds.map(Number) },
      })
      setManagerName('')
      setManagerEmail('')
      setManagerRestaurantIds([])
      setManagerCreatedMessage(result.reset_link_sent
        ? 'Menaxheri u krijua dhe iu dërgua email për të vendosur fjalëkalimin.'
        : 'Menaxheri u krijua, por emaili nuk u dërgua. Kontrollo konfigurimin e emailit në backend.')
      await loadStaffData()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeStaff(staffMember) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/admin/branches/${selectedBranchId}/staff/${staffMember.id}`, { method: 'DELETE' })
      await Promise.all([loadBranchStaff(selectedBranchId), loadStaffData()])
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function setAccountStatus(account) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/admin/users/${account.id}/status`, {
        method: 'PATCH',
        body: { is_active: !account.is_active },
      })
      await loadStaffData()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function setAdministratorRole(account) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/admin/users/${account.id}/administrator`, {
        method: 'PATCH',
        body: { is_administrator: account.role !== 'administrator' },
      })
      await loadStaffData()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(restaurant, status) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/admin/restaurants/${restaurant.id}/status`, { method: 'PATCH', body: { status } })
      await loadRestaurants()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function addCategory(event) {
    event.preventDefault()
    if (!name.trim() || !selectedId) return
    setBusy(true)
    setError('')
    try {
      await request(`/api/admin/restaurants/${selectedId}/categories`, { method: 'POST', body: { name: name.trim() } })
      setName('')
      await loadCategories(selectedId)
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleCategory(category) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/admin/restaurants/${selectedId}/categories/${category.id}`, { method: 'PATCH', body: { is_active: !category.is_active } })
      await loadCategories(selectedId)
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === Number(selectedId))
  const visibleAccounts = accounts.filter((account) => `${account.name} ${account.email} ${account.role}`.toLocaleLowerCase().includes(accountSearch.trim().toLocaleLowerCase()))
  const query = restaurantSearch.trim().toLocaleLowerCase()
  const visibleRestaurants = restaurants.filter((restaurant) => {
    const matchesSearch = !query
      || restaurant.name.toLocaleLowerCase().includes(query)
      || restaurant.business_type.replaceAll('_', ' ').toLocaleLowerCase().includes(query)
    return matchesSearch && (restaurantStatusFilter === 'all' || restaurant.status === restaurantStatusFilter)
  })
  const totalBranches = restaurants.reduce((total, restaurant) => total + Number(restaurant.branches_count || 0), 0)
  const restaurantStats = [
    { label: 'Restorante', detail: 'Në platformë', value: restaurants.length, icon: <StoreIcon size={18} />, tone: 'orange' },
    { label: 'Të miratuara', detail: 'Aktive në katalog', value: restaurants.filter((restaurant) => restaurant.status === 'approved').length, icon: <ShieldIcon size={18} />, tone: 'green' },
    { label: 'Në pritje', detail: 'Presin vendim', value: restaurants.filter((restaurant) => restaurant.status === 'pending').length, icon: <TagIcon size={18} />, tone: 'amber' },
    { label: 'Filiale', detail: 'Gjithsej në platformë', value: totalBranches, icon: <UsersIcon size={18} />, tone: 'blue' },
  ]

  return (
    <div className={`portal-page admin-portal-page ${theme === 'dark' ? 'dark-theme' : ''}`}>
      {/* Top Fixed Operations Bar */}
      <header className="portal-topbar">
        <div className="portal-brand-block">
          <FoodoraLogo />
          <span className="portal-role-pill administrator" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <ShieldIcon size={13} />
            <span>{t('PANELI I ADMINISTRATORIT')}</span>
          </span>
          <span className="portal-branch-meta">{t('Menaxhimi Qendror i Platformës')}</span>
        </div>

        <div className="portal-actions-block">
          <LanguageToggle />
          <button className="portal-refresh-btn" onClick={loadRestaurants} disabled={loading} title={t('Rifresko të dhënat')}>
            <RefreshCwIcon size={14} />
            <span>{t(loading ? 'Po ngarkohet…' : 'Rifresko')}</span>
          </button>

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

          {/* Dedicated Exit Button - only way to leave the admin panel */}
          <button className="portal-exit-button portal-exit-icon" onClick={onClose} title={t('Dil nga paneli i administratorit dhe kthehu te dyqani')} aria-label={t('Dil nga paneli i administratorit dhe kthehu te dyqani')}>
            <BackArrowIcon size={15} />
            <span>{t('Kthehu te Ballina')}</span>
          </button>
        </div>
      </header>

      {/* Main Admin Portal View */}
      <main className="portal-main-container">
        <div className="portal-intro-banner">
          <div>
            <h2>{t('Menaxhimi i Restoranteve & Filialeve')}</h2>
            <p>{t('Kontrollo statusin e restoranteve, menaxho kategoritë dhe cakto stafin nëpër filiale.')}</p>
          </div>
          {user && (
            <div className="portal-user-meta">
              <span>{t('Administrator:')} <strong>{user.name}</strong></span>
              <small>{user.email}</small>
            </div>
          )}
        </div>

        {error && (
          <div className="admin-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangleIcon size={16} />
            <span>{t(error)}</span>
          </div>
        )}

        {loading ? (
          <div className="portal-loading-state" role="status">{t('Po ngarkohen restorantet e platformës…')}</div>
        ) : (
          <>
            <section className="admin-dashboard-summary" aria-label={t('Përmbledhja e platformës')}>
              {restaurantStats.map((stat) => (
                <article className="admin-summary-card" key={stat.label}>
                  <span className={`admin-summary-icon ${stat.tone}`}>{stat.icon}</span>
                  <div>
                    <small>{t(stat.label)}</small>
                    <strong>{stat.value}</strong>
                    <span>{t(stat.detail)}</span>
                  </div>
                </article>
              ))}
            </section>

            <div className="admin-dashboard-layout">
              <section className="admin-list">
                <div className="admin-panel-heading">
                  <div>
                    <h3><StoreIcon size={18} /> {t('Restorantet')}</h3>
                    <p>{t('Menaxho statusin dhe kategoritë e restoranteve të regjistruara.')}</p>
                  </div>
                  <span className="admin-panel-count">{visibleRestaurants.length} / {restaurants.length}</span>
                </div>

                <div className="admin-list-toolbar">
                  <label className="admin-search">
                    <span className="visually-hidden">{t('Kërko restorant')}</span>
                    <input
                      type="search"
                      value={restaurantSearch}
                      onChange={(event) => setRestaurantSearch(event.target.value)}
                      placeholder={t('Kërko sipas emrit ose llojit…')}
                    />
                  </label>
                  <select
                    aria-label={t('Filtro restorantet sipas statusit')}
                    value={restaurantStatusFilter}
                    onChange={(event) => setRestaurantStatusFilter(event.target.value)}
                  >
                    <option value="all">{t('Të gjitha statuset')}</option>
                    <option value="pending">{t('Në pritje')}</option>
                    <option value="approved">{t('Të miratuara')}</option>
                    <option value="rejected">{t('Të refuzuara')}</option>
                    <option value="suspended">{t('Të pezulluara')}</option>
                  </select>
                </div>

                {visibleRestaurants.length ? visibleRestaurants.map((restaurant) => (
                  <article className="admin-restaurant" key={restaurant.id}>
                    <div>
                      <strong>{restaurant.name}</strong>
                      <small>
                        {t(restaurant.business_type.replaceAll('_', ' '))} · {restaurant.branches_count} {t('filiale')} · {restaurant.products_count} {t('produkte')}
                      </small>
                      <span className={`admin-status ${restaurant.status}`}>
                        {t(restaurantStatusLabels[restaurant.status] || restaurant.status)}
                      </span>
                    </div>
                    <div className="admin-actions">
                      <button
                        disabled={busy || restaurant.status === 'approved'}
                        onClick={() => changeStatus(restaurant, 'approved')}
                      >
                        {t('Mirato')}
                      </button>
                      <button
                        disabled={busy || restaurant.status === 'suspended'}
                        onClick={() => changeStatus(restaurant, 'suspended')}
                      >
                        {t('Pezullo')}
                      </button>
                      <button
                        className="admin-select"
                        onClick={() => setSelectedId(restaurant.id)}
                        aria-pressed={selectedId === restaurant.id}
                      >
                        {t('Kategoritë')}
                      </button>
                    </div>
                  </article>
                )) : (
                  <p className="admin-empty">
                    {t(restaurants.length ? 'Nuk u gjet asnjë restorant me këto kritere.' : 'Nuk ka restorante të regjistruara.')}
                  </p>
                )}
              </section>

              <aside className="admin-side-stack" aria-label={t('Menaxhimi i kategorive dhe stafit')}>
                <section className="admin-categories">
                  <div className="admin-panel-heading">
                    <div>
                      <h3><TagIcon size={18} /> {t('Kategoritë')}</h3>
                      <p>{selectedRestaurant ? t('Restoranti aktiv: {name}', { name: selectedRestaurant.name }) : t('Zgjidh një restorant për të menaxhuar kategoritë.')}</p>
                    </div>
                  </div>
                  {selectedRestaurant && (
                    <form onSubmit={addCategory}>
                      <label htmlFor="admin-category-name">{t('Shto kategori të re')}</label>
                      <div>
                        <input
                          id="admin-category-name"
                          maxLength="100"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder={t('p.sh. Pica speciale')}
                          required
                        />
                        <button disabled={busy}>+ {t('Shto')}</button>
                      </div>
                    </form>
                  )}
                  {categories.length ? (
                    <ul>
                      {categories.map((category) => (
                        <li key={category.id}>
                          <span>
                            {category.name}
                            <small>{category.slug}</small>
                          </span>
                          <button
                            disabled={busy}
                            aria-pressed={category.is_active}
                            onClick={() => toggleCategory(category)}
                          >
                            {t(category.is_active ? '✓ Aktive' : 'Jo aktive')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="admin-empty">{t('Nuk ka kategori për këtë restorant.')}</p>
                  )}
                </section>

                <section className="admin-staff">
                  <div className="admin-panel-heading">
                    <div>
                      <h3><UsersIcon size={18} /> {t('Caktimi i stafit')}</h3>
                      <p>{t('Menaxho qasjen e stafit në filialet e platformës.')}</p>
                    </div>
                  </div>
                  <form onSubmit={createManager}>
                    <label htmlFor="admin-manager-name">{t('Emri i menaxherit')}</label>
                    <input id="admin-manager-name" value={managerName} onChange={(event) => setManagerName(event.target.value)} maxLength={120} required />
                    <label htmlFor="admin-manager-email">{t('Email i menaxherit')}</label>
                    <input id="admin-manager-email" type="email" value={managerEmail} onChange={(event) => setManagerEmail(event.target.value)} required />
                    <label htmlFor="admin-manager-restaurants">{t('Restorantet që do të menaxhojë')}</label>
                    <select
                      id="admin-manager-restaurants"
                      multiple
                      size={Math.min(5, Math.max(2, new Set(branches.map((branch) => branch.restaurant_id)).size))}
                      value={managerRestaurantIds}
                      onChange={(event) => setManagerRestaurantIds(Array.from(event.target.selectedOptions, (option) => option.value))}
                      required
                    >
                      {[...new Map(branches.map((branch) => [branch.restaurant_id, branch.restaurant])).values()].map((restaurant) => (
                        <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
                      ))}
                    </select>
                    <button disabled={busy || !managerRestaurantIds.length}>+ {t('Krijo menaxherin dhe dërgo ftesën')}</button>
                  </form>
                  {managerCreatedMessage && <p role="status">{t(managerCreatedMessage)}</p>}

                  <label htmlFor="admin-staff-branch">{t('Zgjidh filialin')}</label>
                  <select
                    id="admin-staff-branch"
                    value={selectedBranchId}
                    onChange={(event) => setSelectedBranchId(event.target.value)}
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.restaurant.name} · {branch.name} ({branch.city})
                      </option>
                    ))}
                  </select>

                  <form onSubmit={assignStaff}>
                    <label htmlFor="admin-staff-account">{t('Llogaria e përdoruesit')}</label>
                    <select
                      id="admin-staff-account"
                      value={staffUserId}
                      onChange={(event) => setStaffUserId(event.target.value)}
                      required
                    >
                      <option value="">{t('Zgjidhni një llogari')}</option>
                      {staffAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} · {account.email} ({t(account.role.replaceAll('_', ' '))})
                        </option>
                      ))}
                    </select>

                    <label htmlFor="admin-staff-role">{t('Roli operativ në këtë filial')}</label>
                    <div className="admin-staff-form-row">
                      <select
                        id="admin-staff-role"
                        value={staffRole}
                        onChange={(event) => setStaffRole(event.target.value)}
                      >
                        <option value="restaurant_manager">{t('Menaxher Restoranti')}</option>
                        <option value="kitchen_worker">{t('Punonjës Kuzhine')}</option>
                        <option value="pickup_worker">{t('Sporteli i Marrjes')}</option>
                      </select>
                      <button disabled={busy || !selectedBranchId}>+ {t('Cakto')}</button>
                    </div>
                  </form>

                  {branchStaff.length ? (
                    <ul>
                      {branchStaff.map((staffMember) => (
                        <li key={staffMember.id}>
                          <span>
                            {staffMember.name}
                            <small>{staffMember.email} · {t(staffMember.branch_role.replaceAll('_', ' '))}</small>
                          </span>
                          <button disabled={busy} onClick={() => removeStaff(staffMember)}>
                            {t('Hiq')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="admin-empty">{t('Nuk ka staf të caktuar në këtë filial ende.')}</p>
                  )}
                </section>
              </aside>
            </div>

            <section className="admin-users">
              <div className="admin-panel-heading">
                <div>
                  <h3><UsersIcon size={18} /> {t('Llogaritë e platformës')}</h3>
                  <p>{t('Regjistrimi krijon klientë. Vetëm administratori mund t’i japë ose t’ia heqë një llogarie rolin administrator; stafin e cakton sipas degës.')}</p>
                </div>
                <label className="admin-search">
                  <span className="visually-hidden">{t('Kërko llogari')}</span>
                  <input type="search" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder={t('Kërko sipas emrit ose email-it…')} />
                </label>
              </div>
              <div className="admin-user-list">
                {visibleAccounts.map((account) => (
                  <article className="admin-user-row" key={account.id}>
                    <div>
                      <strong>{account.name}</strong>
                      <small>{account.email} · {t(account.role.replaceAll('_', ' '))}</small>
                    </div>
                    <span className={`admin-user-state ${account.is_active ? 'active' : 'inactive'}`}>
                      {t(account.is_active ? 'Aktive' : 'Jo aktive')}
                    </span>
                    <div className="admin-user-actions">
                      <button
                        disabled={busy || !account.is_active || account.id === user.id}
                        title={account.id === user.id ? t('Nuk mund ta ndryshoni rolin e llogarisë suaj') : undefined}
                        onClick={() => setAdministratorRole(account)}
                      >
                        {t(account.role === 'administrator' ? 'Hiq rolin administrator' : 'Bëje administrator')}
                      </button>
                      <button
                        disabled={busy || account.id === user.id}
                        title={account.id === user.id ? t('Nuk mund ta çaktivizoni llogarinë tuaj') : undefined}
                        onClick={() => setAccountStatus(account)}
                      >
                        {t(account.is_active ? 'Çaktivizo' : 'Aktivizo')}
                      </button>
                    </div>
                  </article>
                ))}
                {!visibleAccounts.length && <p className="admin-empty">{t('Nuk u gjet asnjë llogari.')}</p>}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
