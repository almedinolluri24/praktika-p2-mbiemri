import { useCallback, useEffect, useMemo, useState } from 'react'
import { prepareCsrf, readCsrfCookie } from '../services/auth.js'
import { DownloadIcon } from './Icons.jsx'
import { useLanguage } from '../i18n/useLanguage.js'

const weekdays = ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë']

async function managerRequest(url, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    await prepareCsrf()
    headers['X-XSRF-TOKEN'] = readCsrfCookie()
  }
  const response = await fetch(url, { method, credentials: 'include', headers, ...(body ? { body: JSON.stringify(body) } : {}) })
  const result = await response.json()
  if (!response.ok) throw new Error(Object.values(result.errors || {}).flat()[0] || result.message || 'Manager request failed.')
  return result
}

export function ManagerTools({ section }) {
  const { t } = useLanguage()
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [products, setProducts] = useState([])
  const [staff, setStaff] = useState([])
  const [staffEmail, setStaffEmail] = useState('')
  const [staffRole, setStaffRole] = useState('kitchen_worker')
  const [hours, setHours] = useState([])
  const [report, setReport] = useState(null)
  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')
  const [appliedReportRange, setAppliedReportRange] = useState({ from: '', to: '' })
  const [categories, setCategories] = useState([])
  const [newCategory, setNewCategory] = useState('')
  const [branchPrices, setBranchPrices] = useState({})
  const [form, setForm] = useState({ name: '', description: '', allergens: '', price: '', category_id: '', prep_station: 'packaging', prep_minutes: 15, option_group_ids: [] })
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadBranches = useCallback(async () => {
    try {
      const result = await managerRequest('/api/manager/branches')
      setBranches(result.data)
      setBranchId((current) => current || String(result.data[0]?.id || ''))
    } catch (loadError) {
      setError(loadError.message)
    }
  }, [])

  const loadSection = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    setError('')
    try {
      if (section === 'menu') {
        const result = await managerRequest(`/api/manager/branches/${branchId}/products`)
        setProducts(result.data)
        setCategories(result.categories)
      } else if (section === 'hours') {
        const result = await managerRequest(`/api/manager/branches/${branchId}/hours`)
        setHours(result.data)
      } else if (section === 'staff') {
        const result = await managerRequest(`/api/manager/branches/${branchId}/staff`)
        setStaff(result.data)
      } else {
        const query = new URLSearchParams()
        if (appliedReportRange.from) query.set('from', appliedReportRange.from)
        if (appliedReportRange.to) query.set('to', appliedReportRange.to)
        const suffix = query.size ? `?${query.toString()}` : ''
        const result = await managerRequest(`/api/manager/branches/${branchId}/reports${suffix}`)
        setReport(result.data)
      }
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [appliedReportRange, branchId, section])

  useEffect(() => {
    const timer = window.setTimeout(loadBranches, 0)
    return () => window.clearTimeout(timer)
  }, [loadBranches])
  useEffect(() => {
    const timer = window.setTimeout(loadSection, 0)
    return () => window.clearTimeout(timer)
  }, [loadSection])

  const optionGroups = useMemo(() => [...new Map(products.flatMap((product) => product.option_groups || []).map((group) => [group.id, group])).values()], [products])

  async function createProduct(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const declaredAllergens = form.allergens.split(',').map((allergen) => allergen.trim()).filter(Boolean)
      const body = { ...form, category_id: Number(form.category_id), price: Number(form.price), prep_minutes: Number(form.prep_minutes), allergens: declaredAllergens.length ? declaredAllergens : null }
      await managerRequest(`/api/manager/branches/${branchId}/products`, { method: 'POST', body })
      setForm((current) => ({ ...current, name: '', description: '', allergens: '', price: '' }))
      await loadSection()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleAvailability(product) {
    setBusy(true)
    setError('')
    try {
      await managerRequest(`/api/manager/branches/${branchId}/products/${product.id}`, { method: 'PATCH', body: { branch_available: !product.pivot.is_available } })
      await loadSection()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveBranchPrice(product) {
    setBusy(true)
    setError('')
    try {
      const raw = branchPrices[product.id] ?? String(product.pivot?.price_override ?? product.price)
      await managerRequest(`/api/manager/branches/${branchId}/products/${product.id}`, { method: 'PATCH', body: { branch_price: raw === '' ? null : Number(raw) } })
      await loadSection()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function createCategory(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await managerRequest(`/api/manager/branches/${branchId}/categories`, { method: 'POST', body: { name: newCategory.trim() } })
      setNewCategory('')
      await loadSection()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveHours(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await managerRequest(`/api/manager/branches/${branchId}/hours`, { method: 'PUT', body: { hours: hours.map((day) => ({ ...day, opens_at: day.opens_at || null, closes_at: day.closes_at || null })) } })
      await loadSection()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function assignStaff(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await managerRequest(`/api/manager/branches/${branchId}/staff`, { method: 'POST', body: { email: staffEmail.trim(), role: staffRole } })
      setStaffEmail('')
      await loadSection()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeStaff(user) {
    setBusy(true)
    setError('')
    try {
      await managerRequest(`/api/manager/branches/${branchId}/staff/${user.id}`, { method: 'DELETE' })
      await loadSection()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  function exportReportCsv() {
    if (!report) return
    const lines = [
      [t('RAPORTI I PERFORMANCES SE DEGES'), branch ? `${branch.name} (${branch.city})` : ''],
      [t('Gjeneruar me date'), new Date().toLocaleString()],
      [],
      [t('METRIKA'), t('VLERA')],
      [t('Porosi gjithsej'), report.orders_total],
      [t('Te ardhura te arketuara (EUR)'), Number(report.paid_revenue).toFixed(2)],
      [t('Porosi te perfunduara'), report.completed_orders],
      [t('Koha mesatare e pergatitjes (min)'), report.average_preparation_minutes ?? '—'],
      [t('Porosi me vonese'), report.late_orders],
      [t('Te anuluara ose te refuzuara'), report.cancelled_or_rejected ?? 0],
      [],
      [t('PRODUKTET ME TE SHITURA (BESTSELLERS)')],
      [t('Produkti'), t('Sasia e shitur'), t('Xhiro (EUR)')],
      ...report.bestsellers.map((item) => [item.product_name, item.quantity, Number(item.revenue).toFixed(2)]),
      [],
      [t('POROSITE SIPAS STATUSIT')],
      ...Object.entries(report.orders_by_status || {}).map(([st, cnt]) => [t(st), cnt]),
    ]
    const csvContent = 'data:text/csv;charset=utf-8,' + lines.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `raporti_deges_${branchId}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const branch = branches.find((item) => String(item.id) === branchId)

  return <section className="manager-tools">
    <div className="manager-tools-heading">
      <div>
        <h3>
          {section === 'menu' ? <>🍽️ {t('Menaxhimi i menusë')}</>
            : section === 'hours' ? <>🕒 {t('Oraret e marrjes & Kapaciteti')}</>
            : section === 'staff' ? <>👥 {t('Stafi i filialit')}</>
            : <>📊 {t('Performanca & Raportet')}</>}
        </h3>
        <p>{t('Ndryshimet zbatohen ekskluzivisht për filialin e përzgjedhur dhe ruhen në server.')}</p>
      </div>
      <label>
        {t('Filiali aktiv')}
        <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
          {branches.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.city}</option>)}
        </select>
      </label>
    </div>

    {error && <p className="admin-error" role="alert">⚠️ {t(error)}</p>}

    {loading ? <p role="status">{t('Po ngarkohen të dhënat e filialit…')}</p> : section === 'menu' ? <div className="manager-menu-layout">
      <div className="manager-product-list">
        {products.map((product) => (
          <article key={product.id}>
            <div>
              <strong>{product.name}</strong>
              <span>{product.category?.name} · {t('Çmimi bazë')} €{Number(product.price).toFixed(2)} · {t(({ pizza: 'Pica', grill: 'Zgarë', oven: 'Furrë', drinks: 'Pije', packaging: 'Paketim' })[product.prep_station] || product.prep_station)}</span>
              <label className="manager-branch-price">
                {t('Çmimi për këtë filial (€)')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={Number(product.price).toFixed(2)}
                  value={branchPrices[product.id] ?? product.pivot?.price_override ?? ''}
                  onChange={(event) => setBranchPrices((current) => ({ ...current, [product.id]: event.target.value }))}
                />
                <button disabled={busy} onClick={() => saveBranchPrice(product)}>{t('Ruaj çmimin')}</button>
              </label>
            </div>
            <button
              disabled={busy}
              aria-pressed={product.pivot.is_available}
              onClick={() => toggleAvailability(product)}
            >
              {t(product.pivot.is_available ? '✓ Në gjendje' : 'E padisponueshme')}
            </button>
          </article>
        ))}

        <form className="manager-category-form" onSubmit={createCategory}>
          <label>
            {t('Shto kategori të re në menu')}
            <input
              required
              maxLength="100"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              placeholder={t('p.sh. Speciale të stinës')}
            />
          </label>
          <button disabled={busy}>+ {t('Shto kategorinë')}</button>
        </form>
      </div>

      <form className="manager-product-form" onSubmit={createProduct}>
        <h4>{t('Shto produkt të ri')}</h4>
        {!categories.length ? <p>{t('Krijoni më parë një kategori në panelin e administratorit.')}</p> : <>
          <label>
            {t('Kategoria')}
            <select required value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}>
              <option value="">{t('Zgjidhni kategorinë')}</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>{t('Emri i produktit')}<input required maxLength="160" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t('p.sh. Pizza Quattro Formaggi')} /></label>
          <label>{t('Përshkrimi i produktit')}<textarea maxLength="2000" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={t('Përbërësit kryesorë...')} /></label>
          <label>{t('Alergjenët e deklaruar (të ndarë me presje)')}<input maxLength="1000" placeholder={t('p.sh. gluten, qumësht, vezë')} value={form.allergens} onChange={(event) => setForm({ ...form, allergens: event.target.value })} /></label>
          <div className="manager-form-row">
            <label>{t('Çmimi (€)')}<input type="number" required min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
            <label>{t('Koha e përgatitjes (min)')}<input type="number" min="1" max="300" value={form.prep_minutes} onChange={(event) => setForm({ ...form, prep_minutes: event.target.value })} /></label>
          </div>
          <label>
            {t('Stacioni i kuzhinës')}
            <select value={form.prep_station} onChange={(event) => setForm({ ...form, prep_station: event.target.value })}>
              {['pizza', 'grill', 'oven', 'drinks', 'packaging'].map((station) => <option key={station} value={station}>{t(({ pizza: 'Pica', grill: 'Zgarë', oven: 'Furrë', drinks: 'Pije', packaging: 'Paketim' })[station])}</option>)}
            </select>
          </label>
          {optionGroups.length > 0 && (
            <fieldset>
              <legend>{t('Grupet e opsioneve (opsionale)')}</legend>
              {optionGroups.map((group) => (
                <label className="manager-option" key={group.id}>
                  <input
                    type="checkbox"
                    checked={form.option_group_ids.includes(group.id)}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      option_group_ids: event.target.checked
                        ? [...current.option_group_ids, group.id]
                        : current.option_group_ids.filter((id) => id !== group.id)
                    }))}
                  />
                  {group.name}
                </label>
              ))}
            </fieldset>
          )}
          <button disabled={busy || !branch}>{t(busy ? 'Po ruhet…' : '+ Shto produktin')}</button>
        </>}
      </form>
    </div> : section === 'hours' ? (
      <form className="manager-hours-form" onSubmit={saveHours}>
        {hours.map((day) => (
          <div className="manager-hour-day" key={day.weekday}>
            <strong>{t(weekdays[day.weekday])}</strong>
            <label className="manager-option">
              <input
                type="checkbox"
                checked={day.is_closed}
                onChange={(event) => setHours((current) => current.map((item) => item.weekday === day.weekday ? { ...item, is_closed: event.target.checked } : item))}
              />
              {t('Mbyllur')}
            </label>
            <label>{t('Hapet')}<input type="time" disabled={day.is_closed} value={day.opens_at?.slice(0, 5) || ''} onChange={(event) => setHours((current) => current.map((item) => item.weekday === day.weekday ? { ...item, opens_at: event.target.value } : item))} /></label>
            <label>{t('Mbyllet')}<input type="time" disabled={day.is_closed} value={day.closes_at?.slice(0, 5) || ''} onChange={(event) => setHours((current) => current.map((item) => item.weekday === day.weekday ? { ...item, closes_at: event.target.value } : item))} /></label>
            <label>{t('Porosi për interval')}<input type="number" min="1" max="500" value={day.orders_per_slot} onChange={(event) => setHours((current) => current.map((item) => item.weekday === day.weekday ? { ...item, orders_per_slot: Number(event.target.value) } : item))} /></label>
            <label>{t('Intervali (minuta)')}<input type="number" min="5" max="120" value={day.slot_interval_minutes} onChange={(event) => setHours((current) => current.map((item) => item.weekday === day.weekday ? { ...item, slot_interval_minutes: Number(event.target.value) } : item))} /></label>
          </div>
        ))}
        <button disabled={busy || hours.length !== 7}>{t(busy ? 'Po ruhet…' : 'Ruaj orarin javor & kapacitetin')}</button>
      </form>
    ) : section === 'staff' ? (
      <div className="manager-staff-tools">
        <form onSubmit={assignStaff}>
          <label>
            {t('Email-i i llogarisë së përdoruesit')}
            <input
              type="email"
              value={staffEmail}
              onChange={(event) => setStaffEmail(event.target.value)}
              placeholder={t('p.sh. kitchen@foodora.demo')}
              required
            />
          </label>
          <label>
            {t('Roli në këtë filial')}
            <select value={staffRole} onChange={(event) => setStaffRole(event.target.value)}>
              <option value="kitchen_worker">{t('Punonjës Kuzhine')}</option>
              <option value="pickup_worker">{t('Sporteli i Marrjes')}</option>
            </select>
          </label>
          <button disabled={busy || !branchId}>{t(busy ? 'Po ruhet…' : '+ Cakto stafin')}</button>
        </form>
        <ul>
          {staff.map((person) => (
            <li key={person.id}>
              <span>
                {person.name}
                <small>{person.email} · {t(person.branch_role === 'kitchen_worker' ? 'Kuzhinë' : person.branch_role === 'pickup_worker' ? 'Marrje' : person.branch_role)}</small>
              </span>
              <button disabled={busy} onClick={() => removeStaff(person)}>{t('Hiq nga filiali')}</button>
            </li>
          ))}
        </ul>
        {!staff.length && <p>{t('Nuk ka staf të caktuar në këtë filial ende.')}</p>}
      </div>
    ) : report && (
      <div className="manager-report">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <form className="manager-report-filter" onSubmit={(event) => { event.preventDefault(); setAppliedReportRange({ from: reportFrom, to: reportTo }) }}>
            <label>{t('Nga data')}<input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} /></label>
            <label>{t('Deri më')}<input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} /></label>
            <button>{t('Filtro periudhën')}</button>
          </form>
          <button
            type="button"
            className="wolt-btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 16px', fontSize: '11px' }}
            onClick={exportReportCsv}
          >
            <DownloadIcon size={14} />
            <span>{t('Shkarko raportin (CSV)')}</span>
          </button>
        </div>

        <div className="manager-report-stats">
          <article><small>{t('Porosi gjithsej')}</small><strong>{report.orders_total}</strong></article>
          <article><small>{t('Të ardhura të arkëtuara')}</small><strong>€{Number(report.paid_revenue).toFixed(2)}</strong></article>
          <article><small>{t('Të përfunduara')}</small><strong>{report.completed_orders}</strong></article>
          <article><small>{t('Koha mesatare (fillim → gati)')}</small><strong>{report.average_preparation_minutes ?? '—'} {t('min')}</strong></article>
          <article><small>{t('Porosi me vonesë')}</small><strong>{report.late_orders}</strong></article>
          <article><small>{t('Të anuluara / refuzuara')}</small><strong>{report.cancelled_or_rejected ?? 0}</strong></article>
        </div>

        <h4>{t('Pjatat më të shitura (Bestsellers)')}</h4>
        {report.bestsellers.length ? (
          <ol>
            {report.bestsellers.map((item) => (
              <li key={item.product_name}>
                <span>{item.product_name} · {t('{count} të shitura', { count: item.quantity })}</span>
                <strong>€{Number(item.revenue).toFixed(2)}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p>{t('Nuk ka shitje të përfunduara për këtë periudhë.')}</p>
        )}

        <h4>{t('Porositë sipas statusit')}</h4>
        <div className="manager-status-counts">
          {Object.entries(report.orders_by_status).map(([status, count]) => (
            <span key={status}>
              {t(status)}: <strong>{count}</strong>
            </span>
          ))}
        </div>
      </div>
    )}
  </section>
}
