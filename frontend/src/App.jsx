import { useEffect, useMemo, useState } from 'react'
import { CartDrawer } from './components/CartDrawer.jsx'
import { AdminPanel } from './components/AdminPanel.jsx'
import { Footer } from './components/Footer.jsx'
import { FoodCard } from './components/FoodCard.jsx'
import { Hero } from './components/Hero.jsx'
import { HowItWorks } from './components/HowItWorks.jsx'
import { LoginModal } from './components/LoginModal.jsx'
import { Navbar } from './components/Navbar.jsx'
import { OrdersPanel } from './components/OrdersPanel.jsx'
import { ProductOptionsModal } from './components/ProductOptionsModal.jsx'
import { RoleDashboard } from './components/RoleDashboard.jsx'
import { RestaurantCard } from './components/RestaurantCard.jsx'
import { RestaurantProfile } from './components/RestaurantProfile.jsx'
import { CategoryIcon } from './components/Icons.jsx'
import { useLanguage } from './i18n/useLanguage.js'
import { getAuthenticatedUser, logout } from './services/auth.js'
import { getPostAuthDestination } from './services/authDestination.js'
import { loadCatalog, loadCatalogFilters } from './services/catalog.js'
import { createPickupOrder } from './services/orders.js'
import './App.css'
import './styles/site-refresh.css'
import './styles/portal.css'
import './styles/catalog-refresh.css'
import './styles/food-refresh.css'

const categoryLabels = {
  All: 'Të gjitha',
  Pizza: 'Pica',
  Burgers: 'Hamburgerë',
  Pasta: 'Makarona',
  Bowls: 'Tasa & Sallata',
  Sushi: 'Sushi',
  Tacos: 'Tako',
  Sides: 'Shoqëruese',
  Cafe: 'Kafe & Pije',
  Bakery: 'Furrë & Brumëra',
  Desserts: 'Ëmbëlsira',
  Traditional: 'Tradicionale',
  Healthy: 'E shëndetshme',
}

const businessTypesByCuisine = {
  Italian: 'pizzeria',
  Burgers: 'fast_food',
  Traditional: 'traditional_restaurant',
  Cafe: 'cafe',
  Bakery: 'bakery',
  Desserts: 'sweet_shop',
  Healthy: 'healthy_kitchen',
}

const cuisineByBusinessType = {
  pizzeria: 'Italian',
  fast_food: 'Burgers',
  traditional_restaurant: 'Traditional',
  cafe: 'Cafe',
  bakery: 'Bakery',
  sweet_shop: 'Desserts',
  healthy_kitchen: 'Healthy',
}

function App() {
  const { t } = useLanguage()
  const [theme, setTheme] = useState(() => localStorage.getItem('foodora_theme') || 'light')
  const [restaurants, setRestaurants] = useState([])
  const [foods, setFoods] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [restaurantCategoryOptions, setRestaurantCategoryOptions] = useState(['All'])
  const [foodCategoryOptions, setFoodCategoryOptions] = useState(['All'])
  const [cityOptions, setCityOptions] = useState([])
  const [search, setSearch] = useState('')
  const [restaurantCategory, setRestaurantCategory] = useState('All')
  const [foodCategory, setFoodCategory] = useState('All')
  const [selectedRestaurant, setSelectedRestaurant] = useState(null)
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [cityFilter, setCityFilter] = useState('All')
  const [openOnly, setOpenOnly] = useState(false)
  const [cart, setCart] = useState({})
  const [cartOpen, setCartOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [authPageOpen, setAuthPageOpen] = useState(() => new URLSearchParams(window.location.search).has('reset_token'))
  const [authMode, setAuthMode] = useState(() => new URLSearchParams(window.location.search).has('reset_token') ? 'reset' : 'login')
  const [user, setUser] = useState(null)
  const [optionsFood, setOptionsFood] = useState(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const [priceReview, setPriceReview] = useState(null)
  const [pendingPickup, setPendingPickup] = useState({ scheduleType: 'asap', pickupAt: null, customerNote: '' })
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [roleDashboardOpen, setRoleDashboardOpen] = useState(false)

  async function refreshCatalog(filters = {}) {
    setCatalogLoading(true)
    setCatalogError('')
    try {
      const result = await loadCatalog({
        searchText: search.trim(),
        businessType: restaurantCategory === 'All' ? '' : businessTypesByCuisine[restaurantCategory] || '',
        category: foodCategory === 'All' ? '' : foodCategory,
        city: cityFilter === 'All' ? '' : cityFilter,
        openOnly,
        restaurantId: selectedRestaurant?.id || null,
        selectedBranchId: selectedBranch?.id || null,
        ...filters,
      })
      setRestaurants(result.restaurants)
      setFoods(result.foods)
    } catch (error) {
      setCatalogError(error.message)
    } finally {
      setCatalogLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    getAuthenticatedUser().then((currentUser) => { if (active) setUser(currentUser) }).catch(() => {})
    loadCatalogFilters().then((filters) => {
      if (!active) return
      setRestaurantCategoryOptions(['All', ...filters.business_types.map((type) => cuisineByBusinessType[type] || type)])
      setFoodCategoryOptions(['All', ...filters.categories])
      setCityOptions(filters.cities)
    }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setCatalogLoading(true)
      setCatalogError('')
      try {
        const result = await loadCatalog({
          searchText: search.trim(),
          businessType: restaurantCategory === 'All' ? '' : businessTypesByCuisine[restaurantCategory] || '',
          category: foodCategory === 'All' ? '' : foodCategory,
          city: cityFilter === 'All' ? '' : cityFilter,
          openOnly,
          restaurantId: selectedRestaurant?.id || null,
          selectedBranchId: selectedBranch?.id || null,
        })
        if (!active) return
        setRestaurants(result.restaurants)
        setFoods(result.foods)
      } catch (error) {
        if (active) setCatalogError(error.message)
      } finally {
        if (active) setCatalogLoading(false)
      }
    }, search ? 250 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [cityFilter, foodCategory, openOnly, restaurantCategory, search, selectedRestaurant, selectedBranch])

  const restaurantCategories = restaurantCategoryOptions
  const foodCategories = foodCategoryOptions
  const matchingRestaurants = useMemo(() => restaurants.filter((restaurant) => {
    const matchesCategory = restaurantCategory === 'All' || restaurant.cuisine === restaurantCategory
    const matchesSearch = `${restaurant.name} ${restaurant.cuisine} ${restaurant.description} ${restaurant.city || ''}`.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  }), [restaurantCategory, restaurants, search])

  const visibleFoods = useMemo(() => foods.filter((food) => {
    const matchesPopular = Boolean(selectedRestaurant) || food.popular
    const matchesRestaurant = !selectedRestaurant || food.restaurantId === selectedRestaurant.id
    const matchesBranch = !selectedBranch || food.branchId === selectedBranch.id
    const matchesCategory = foodCategory === 'All' || food.category === foodCategory
    const matchesSearch = `${food.name} ${food.description} ${food.category} ${food.restaurantName}`.toLowerCase().includes(search.toLowerCase())
    return matchesPopular && matchesRestaurant && matchesBranch && matchesCategory && matchesSearch
  }), [foodCategory, foods, search, selectedRestaurant, selectedBranch])

  const cartItems = useMemo(() => Object.entries(cart).map(([id, line]) => ({
    ...line.food,
    id,
    quantity: line.quantity,
    selectedOptions: line.selectedOptions,
    selectedOptionNames: line.selectedOptionNames,
    optionExtra: line.optionExtra,
  })), [cart])
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price + item.optionExtra) * item.quantity, 0)
  const activeCartBranch = cartItems[0]?.branchId

  function showNotice(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  function addToCart(food, selectedOptions = []) {
    const normalizedOptions = [...selectedOptions].sort((a, b) => a - b)
    const optionKey = normalizedOptions.join(',')
    const cartKey = `${food.id}:${optionKey}`
    const currentBranch = cartItems[0]?.branchId
    if (currentBranch && currentBranch !== food.branchId) {
      const accepted = window.confirm(t('Shporta përmban produkte nga një degë tjetër. Zbrazni shportën për të filluar porosi të re me këtë degë?'))
      if (!accepted) return
      setCart({})
      setConfirmation(null)
    }
    const optionObjects = food.optionGroups.flatMap((group) => group.options).filter((option) => normalizedOptions.includes(option.id))
    const line = {
      food,
      quantity: 1,
      selectedOptions: normalizedOptions,
      selectedOptionNames: optionObjects.map((option) => option.name),
      optionExtra: optionObjects.reduce((sum, option) => sum + option.priceDelta, 0),
    }
    setCart((current) => {
      const next = currentBranch && currentBranch !== food.branchId ? {} : current
      return { ...next, [cartKey]: { ...line, quantity: (next[cartKey]?.quantity || 0) + 1 } }
    })
    setCheckoutError('')
    setPriceReview(null)
    setConfirmation(null)
    showNotice(t('{name} u shtua në shportë', { name: food.name }))
  }

  function handleAddClick(food) {
    if (food.optionGroups && food.optionGroups.length > 0) setOptionsFood(food)
    else addToCart(food)
  }

  function updateQuantity(cartId, amount) {
    setCart((current) => {
      const nextQuantity = (current[cartId]?.quantity || 0) + amount
      const next = { ...current }
      if (nextQuantity <= 0) delete next[cartId]
      else next[cartId] = { ...next[cartId], quantity: nextQuantity }
      return next
    })
  }

  function viewMenu(restaurant) {
    setSelectedRestaurant(restaurant)
    const defaultBranch = restaurant.branches?.[0] || null
    setSelectedBranch(defaultBranch)
    setFoodCategory('All')
    setSearch('')
    window.setTimeout(() => document.querySelector('#popular-food')?.scrollIntoView({ behavior: 'smooth' }), 0)
  }

  function handleSelectBranch(branch) {
    if (cartItems.length > 0 && activeCartBranch !== branch.id) {
      const accepted = window.confirm(t('Shporta përmban produkte nga një degë tjetër. Zbrazni shportën për të porositur nga kjo degë?'))
      if (!accepted) return
      setCart({})
      setConfirmation(null)
    }
    setSelectedBranch(branch)
  }

  function clearRestaurant() {
    setSelectedRestaurant(null)
    setSelectedBranch(null)
    setFoodCategory('All')
    document.querySelector('#restaurants')?.scrollIntoView({ behavior: 'smooth' })
  }

  async function submitOrder(pickup = pendingPickup, expectedTotal = cartTotal) {
    if (!user) {
      setCartOpen(false)
      setAuthMode('login')
      setAuthPageOpen(true)
      return
    }
    if (!cartItems.length) return
    setPendingPickup(pickup)
    setCheckoutBusy(true)
    setCheckoutError('')
    try {
      const result = await createPickupOrder({
        branchId: activeCartBranch,
        items: cartItems,
        scheduleType: pickup.scheduleType,
        pickupAt: pickup.pickupAt,
        expectedTotal,
        customerNote: pickup.customerNote,
      })
      setConfirmation(result)
      setPriceReview(null)
      setCart({})
    } catch (error) {
      if (error.status === 409 && error.payload?.quote) setPriceReview(error.payload.quote)
      else setCheckoutError(error.message)
    } finally {
      setCheckoutBusy(false)
    }
  }

  async function handleLogout() {
    try {
      await logout()
      setUser(null)
      showNotice('Keni dalë me sukses nga llogaria.')
    } catch (logoutError) {
      showNotice(logoutError.message)
    }
  }

  function handleLoginSuccess(currentUser, authAction) {
    setUser(currentUser)
    setAuthPageOpen(false)
    const destination = getPostAuthDestination(currentUser.role, authAction)
    setAdminOpen(destination.admin)
    setRoleDashboardOpen(destination.staff)
    setOrdersOpen(destination.orders)
  }

  function handleToggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('foodora_theme', next)
  }

  const displayCategory = (category) => (
    <span className="category-chip-content">
      <CategoryIcon name={category} size={15} />
      <span>{t(categoryLabels[category] || category)}</span>
    </span>
  )

  if (authPageOpen) {
    const closeAuthPage = () => {
      setAuthPageOpen(false)
      if (new URLSearchParams(window.location.search).has('reset_token')) window.history.replaceState({}, '', '/')
    }
    return (
      <div className={`app-shell ${theme === 'dark' ? 'dark-theme' : ''}`} data-theme={theme}>
        <LoginModal
          initialMode={authMode}
          isPage
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onClose={closeAuthPage}
          onSuccess={handleLoginSuccess}
        />
      </div>
    )
  }

  if (roleDashboardOpen && user && ['restaurant_manager', 'kitchen_worker', 'pickup_worker'].includes(user.role)) {
    return (
      <div className={`app-shell portal-view-active ${theme === 'dark' ? 'dark-theme' : ''}`} data-theme={theme}>
        <RoleDashboard
          user={user}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onLogout={handleLogout}
          onClose={() => setRoleDashboardOpen(false)}
        />
        {notice && <div className="toast" role="status">{t(notice)}</div>}
      </div>
    )
  }

  if (adminOpen && user?.role === 'administrator') {
    return (
      <div className={`app-shell portal-view-active ${theme === 'dark' ? 'dark-theme' : ''}`} data-theme={theme}>
        <AdminPanel
          user={user}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onLogout={handleLogout}
          onClose={() => setAdminOpen(false)}
        />
        {notice && <div className="toast" role="status">{t(notice)}</div>}
      </div>
    )
  }

  return (
    <div className={`app-shell ${theme === 'dark' ? 'dark-theme' : ''}`} data-theme={theme}>
      <Navbar
        cartCount={cartCount}
        user={user}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onLogin={() => { setAuthMode('login'); setAuthPageOpen(true) }}
        onRegister={() => { setAuthMode('register'); setAuthPageOpen(true) }}
        onOpenCart={() => setCartOpen(true)}
        onOpenOrders={() => setOrdersOpen(true)}
        onDashboard={() => (user?.role === 'administrator' ? setAdminOpen(true) : setRoleDashboardOpen(true))}
        onShowNotice={showNotice}
      />
      <main>
        <Hero search={search} onSearch={setSearch} />

        <section className="section restaurants-section" id="restaurants">
          <div className="section-heading">
            <div>
              <span className="section-kicker">{t('POROSI ME MARRJE NË RESTORANT')}</span>
              <h2>{t('Zbuloni')} <span>{t('restorantet')}</span> {t('lokale')}</h2>
              <p>{t('Porositni ushqim të freskët nga restorantet më të mira, gati për marrje.')}</p>
            </div>
            <a href="#popular-food" className="text-link">{t('Shfleto të gjitha pjatat')} <span aria-hidden="true">→</span></a>
          </div>

          <div className="filter-bar">
            <div className="category-filters" aria-label={t('Filtro sipas llojit të ushqimit')}>
              {restaurantCategories.map((item) => (
                <button
                  key={item}
                  className={restaurantCategory === item ? 'filter-chip selected' : 'filter-chip'}
                  aria-pressed={restaurantCategory === item}
                  onClick={() => setRestaurantCategory(item)}
                >
                  {displayCategory(item)}
                </button>
              ))}
            </div>
            <div className="restaurant-extra-filters">
              <label htmlFor="restaurant-city">{t('Qyteti')}</label>
              <select id="restaurant-city" value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}>
                <option value="All">{t('Të gjitha qytetet')}</option>
                {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
              <label className="open-only-filter">
                <input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} /> {t('Hapur tani')}
              </label>
            </div>
            <span className="result-count">{matchingRestaurants.length} {t('Restorante')}</span>
          </div>

          {catalogLoading ? (
            <div className="catalog-state" role="status">{t('Po ngarkohen restorantet…')}</div>
          ) : catalogError ? (
            <div className="empty-results" role="alert">
              <h3>{t('Restorantet nuk mund të ngarkohen')}</h3>
              <p>{t(catalogError)}</p>
              <button onClick={refreshCatalog}>{t('Provo përsëri')}</button>
            </div>
          ) : matchingRestaurants.length ? (
            <div className="restaurant-grid">
              {matchingRestaurants.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} onViewMenu={viewMenu} />
              ))}
            </div>
          ) : (
            <div className="empty-results">
              <span aria-hidden="true">⌕</span>
              <h3>{t('Nuk u gjet asnjë restorant')}</h3>
              <p>{t('Provoni një kërkim tjetër ose zgjidhni një kategori tjetër.')}</p>
              <button onClick={() => { setSearch(''); setRestaurantCategory('All') }}>{t('Pastro filtrat')}</button>
            </div>
          )}
        </section>

        <section className="section food-section" id="popular-food">
          {selectedRestaurant && (
            <RestaurantProfile
              restaurant={selectedRestaurant}
              selectedBranch={selectedBranch}
              onSelectBranch={handleSelectBranch}
              onBack={clearRestaurant}
            />
          )}

          <div className="section-heading food-heading">
            <div>
              <span className="section-kicker">{t('MENYJA & USHQIMET')}</span>
              <h2>{selectedRestaurant ? t('Menyja te {name}', { name: selectedRestaurant.name }) : t('Më të kërkuarat tani')}</h2>
              <p>{selectedRestaurant ? (selectedBranch ? t('Gati për marrje te dega: {name}', { name: selectedBranch.name }) : t('Gati për marrje në restorant.')) : t('Ushqimet e preferuara nga restorantet pranë jush.')}</p>
            </div>
            {selectedRestaurant ? (
              <button className="text-link clear-menu" onClick={clearRestaurant}>
                {t('Shiko të gjithë restorantet')} <span aria-hidden="true">→</span>
              </button>
            ) : (
              <a href="#restaurants" className="text-link">{t('Eksploro restorantet')} <span aria-hidden="true">→</span></a>
            )}
          </div>

          <div className="food-categories" aria-label={t('Filtro ushqimet sipas kategorisë')}>
            {foodCategories.map((item) => (
              <button
                key={item}
                className={foodCategory === item ? 'food-category active' : 'food-category'}
                aria-pressed={foodCategory === item}
                onClick={() => setFoodCategory(item)}
              >
                {displayCategory(item)}
              </button>
            ))}
          </div>

          {catalogLoading ? (
            <div className="catalog-state" role="status">{t('Po ngarkohet menyja…')}</div>
          ) : catalogError ? (
            <div className="empty-results compact" role="alert">
              <h3>{t('Menytë nuk janë të qasshme')}</h3>
              <p>{t(catalogError)}</p>
              <button onClick={refreshCatalog}>{t('Provo përsëri')}</button>
            </div>
          ) : visibleFoods.length ? (
            <div className="food-grid">
              {visibleFoods.map((food) => (
                <FoodCard
                  key={`${food.branchId}-${food.id}`}
                  food={food}
                  onAdd={handleAddClick}
                  quantity={cartItems.filter((item) => item.productId === food.productId && item.branchId === food.branchId).reduce((sum, item) => sum + item.quantity, 0)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-results compact">
              <h3>{t('Nuk ka pjata që përputhen me kërkimin tuaj')}</h3>
              <p>{t('Provoni një kërkim tjetër ose pastroni përzgjedhjen e restorantit.')}</p>
              <button onClick={() => { setSearch(''); setSelectedRestaurant(null); setFoodCategory('All') }}>
                {t('Shfaq pjatat kryesore')}
              </button>
            </div>
          )}
        </section>

        <HowItWorks />
      </main>

      <Footer />
      {notice && <div className="toast" role="status">{t(notice)}</div>}
      <CartDrawer
        open={cartOpen}
        items={cartItems}
        total={cartTotal}
        onClose={() => setCartOpen(false)}
        onUpdateQuantity={updateQuantity}
        onCheckout={submitOrder}
        checkingOut={checkoutBusy}
        checkoutError={checkoutError}
        confirmation={confirmation}
        canCheckout={Boolean(user)}
        priceReview={priceReview}
        onConfirmPrice={() => submitOrder(pendingPickup, Number(priceReview.total))}
      />
      {optionsFood && (
        <ProductOptionsModal
          food={optionsFood}
          onClose={() => setOptionsFood(null)}
          onAdd={(ids) => { addToCart(optionsFood, ids); setOptionsFood(null) }}
        />
      )}
      {ordersOpen && user?.role === 'customer' && <OrdersPanel user={user} onProfileUpdated={setUser} onClose={() => setOrdersOpen(false)} />}
    </div>
  )
}

export default App
