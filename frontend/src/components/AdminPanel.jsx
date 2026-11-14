import { useCallback, useEffect, useState } from 'react'
import { prepareCsrf, readCsrfCookie } from '../services/auth.js'

async function request(url, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    await prepareCsrf()
    headers['X-XSRF-TOKEN'] = readCsrfCookie()
  }
  const response = await fetch(url, { method, credentials: 'include', headers, ...(body ? { body: JSON.stringify(body) } : {}) })
  const result = await response.json()
  if (!response.ok) throw new Error(Object.values(result.errors || {}).flat()[0] || result.message || 'Admin request failed.')
  return result
}

export function AdminPanel({ onClose }) {
  const [restaurants, setRestaurants] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [branches, setBranches] = useState([])
  const [staffAccounts, setStaffAccounts] = useState([])
  const [branchStaff, setBranchStaff] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [staffUserId, setStaffUserId] = useState('')
  const [staffRole, setStaffRole] = useState('restaurant_manager')

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
      const [branchResult, accountResult] = await Promise.all([
        request('/api/admin/branches'),
        request('/api/admin/staff-accounts'),
      ])
      setBranches(branchResult.data)
      setStaffAccounts(accountResult.data)
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

  async function removeStaff(user) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/admin/branches/${selectedBranchId}/staff/${user.id}`, { method: 'DELETE' })
      await Promise.all([loadBranchStaff(selectedBranchId), loadStaffData()])
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

  return <div className="admin-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="admin-panel" role="dialog" aria-modal="true" aria-labelledby="admin-title">
      <header className="admin-heading"><div><span>FOODORA ADMIN DASHBOARD</span><h2 id="admin-title">Business review</h2><p>Restaurant visibility and menu categories</p></div><button onClick={onClose} aria-label="Close admin dashboard">×</button></header>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading restaurants…</p> : <div className="admin-content">
        <div className="admin-list"><h3>Restaurants</h3>{restaurants.map((restaurant) => <article className="admin-restaurant" key={restaurant.id}>
          <div><strong>{restaurant.name}</strong><small>{restaurant.business_type.replaceAll('_', ' ')} · {restaurant.branches_count} branches · {restaurant.products_count} products</small><span className={`admin-status ${restaurant.status}`}>{restaurant.status}</span></div>
          <div className="admin-actions"><button disabled={busy || restaurant.status === 'approved'} onClick={() => changeStatus(restaurant, 'approved')}>Approve</button><button disabled={busy || restaurant.status === 'suspended'} onClick={() => changeStatus(restaurant, 'suspended')}>Suspend</button><button className="admin-select" onClick={() => setSelectedId(restaurant.id)} aria-pressed={selectedId === restaurant.id}>Categories</button></div>
        </article>)}</div>
        <div className="admin-categories"><h3>Categories {selectedRestaurant ? `· ${selectedRestaurant.name}` : ''}</h3>
          {selectedRestaurant && <form onSubmit={addCategory}><label htmlFor="admin-category-name">Add category</label><div><input id="admin-category-name" maxLength="100" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Salads" required /><button disabled={busy}>Add</button></div></form>}
          {categories.length ? <ul>{categories.map((category) => <li key={category.id}><span>{category.name}<small>{category.slug}</small></span><button disabled={busy} aria-pressed={category.is_active} onClick={() => toggleCategory(category)}>{category.is_active ? 'Active' : 'Inactive'}</button></li>)}</ul> : <p className="admin-empty">No categories for this restaurant.</p>}
        </div>
        <div className="admin-staff">
          <h3>Branch staff assignments</h3>
          <label htmlFor="admin-staff-branch">Branch</label>
          <select id="admin-staff-branch" value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)}>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.restaurant.name} · {branch.name} ({branch.city})</option>)}
          </select>
          <form onSubmit={assignStaff}>
            <label htmlFor="admin-staff-account">Account</label>
            <select id="admin-staff-account" value={staffUserId} onChange={(event) => setStaffUserId(event.target.value)} required>
              <option value="">Choose an account</option>
              {staffAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.email} ({account.role.replaceAll('_', ' ')})</option>)}
            </select>
            <label htmlFor="admin-staff-role">Role for this branch</label>
            <div className="admin-staff-form-row"><select id="admin-staff-role" value={staffRole} onChange={(event) => setStaffRole(event.target.value)}><option value="restaurant_manager">Manager</option><option value="kitchen_worker">Kitchen</option><option value="pickup_worker">Pickup</option></select><button disabled={busy || !selectedBranchId}>Assign staff</button></div>
          </form>
          {branchStaff.length ? <ul>{branchStaff.map((staff) => <li key={staff.id}><span>{staff.name}<small>{staff.email} · {staff.branch_role.replaceAll('_', ' ')}</small></span><button disabled={busy} onClick={() => removeStaff(staff)}>Remove</button></li>)}</ul> : <p className="admin-empty">No staff assigned to this branch.</p>}
        </div>
      </div>}
    </section>
  </div>
}
