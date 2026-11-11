import { useMemo, useState } from 'react'
import { demoFoods, demoRestaurants, foodCategories } from './data/demoData.js'
import { CartDrawer } from './components/CartDrawer.jsx'
import { Footer } from './components/Footer.jsx'
import { FoodCard } from './components/FoodCard.jsx'
import { Hero } from './components/Hero.jsx'
import { HowItWorks } from './components/HowItWorks.jsx'
import { Navbar } from './components/Navbar.jsx'
import { RestaurantCard } from './components/RestaurantCard.jsx'
import './App.css'

function App() {
  const [search, setSearch] = useState('')
  const [restaurantCategory, setRestaurantCategory] = useState('All')
  const [foodCategory, setFoodCategory] = useState('All')
  const [selectedRestaurant, setSelectedRestaurant] = useState(null)
  const [cart, setCart] = useState({})
  const [cartOpen, setCartOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const matchingRestaurants = useMemo(() => demoRestaurants.filter((restaurant) => {
    const matchesCategory = restaurantCategory === 'All' || restaurant.cuisine === restaurantCategory
    const matchesSearch = `${restaurant.name} ${restaurant.cuisine} ${restaurant.description}`.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  }), [restaurantCategory, search])

  const visibleFoods = useMemo(() => demoFoods.filter((food) => {
    const matchesPopular = Boolean(selectedRestaurant) || food.popular
    const matchesRestaurant = !selectedRestaurant || food.restaurantId === selectedRestaurant.id
    const matchesCategory = foodCategory === 'All' || food.category === foodCategory
    const matchesSearch = `${food.name} ${food.description} ${food.category} ${food.restaurantName}`.toLowerCase().includes(search.toLowerCase())
    return matchesPopular && matchesRestaurant && matchesCategory && matchesSearch
  }), [foodCategory, search, selectedRestaurant])

  const cartItems = demoFoods.filter((food) => cart[food.id]).map((food) => ({ ...food, quantity: cart[food.id] }))
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  function addToCart(food) {
    setCart((current) => ({ ...current, [food.id]: (current[food.id] || 0) + 1 }))
    setNotice(`${food.name} added to your cart`)
    window.setTimeout(() => setNotice(''), 2200)
  }

  function updateQuantity(foodId, amount) {
    setCart((current) => {
      const nextQuantity = (current[foodId] || 0) + amount
      const next = { ...current }
      if (nextQuantity <= 0) delete next[foodId]
      else next[foodId] = nextQuantity
      return next
    })
  }

  function viewMenu(restaurant) {
    setSelectedRestaurant(restaurant)
    setFoodCategory('All')
    setSearch('')
    window.setTimeout(() => document.querySelector('#popular-food')?.scrollIntoView({ behavior: 'smooth' }), 0)
  }

  function clearRestaurant() {
    setSelectedRestaurant(null)
    setFoodCategory('All')
    document.querySelector('#restaurants')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <Navbar cartCount={cartCount} onOpenCart={() => setCartOpen(true)} onShowNotice={(message) => setNotice(message)} />
      <main>
        <Hero search={search} onSearch={setSearch} />

        <section className="section restaurants-section" id="restaurants">
          <div className="section-heading">
            <div><span className="section-kicker">PICKUP, MADE EASY</span><h2>Find your next <span>favorite</span></h2><p>Great local restaurants, ready when you are.</p></div>
            <a href="#popular-food" className="text-link">Browse popular food <span aria-hidden="true">→</span></a>
          </div>
          <div className="filter-bar">
            <div className="category-filters" aria-label="Filter restaurants by cuisine">{['All', 'Italian', 'Burgers', 'Asian', 'Healthy', 'Mexican'].map((item) => <button key={item} className={restaurantCategory === item ? 'filter-chip selected' : 'filter-chip'} onClick={() => setRestaurantCategory(item)}>{item}</button>)}</div>
            <span className="result-count">{matchingRestaurants.length} restaurants</span>
          </div>
          {matchingRestaurants.length ? <div className="restaurant-grid">{matchingRestaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} onViewMenu={viewMenu} />)}</div> : <div className="empty-results"><span>⌕</span><h3>No restaurants found</h3><p>Try another search or choose a different cuisine.</p><button onClick={() => { setSearch(''); setRestaurantCategory('All') }}>Clear filters</button></div>}
        </section>

        <section className="section food-section" id="popular-food">
          <div className="section-heading food-heading">
            <div><span className="section-kicker">GOOD TASTE, GREAT VALUE</span><h2>{selectedRestaurant ? `Menu at ${selectedRestaurant.name}` : 'Popular right now'}</h2><p>{selectedRestaurant ? 'Made fresh and ready for pickup.' : 'Customer favorites from restaurants near you.'}</p></div>
            {selectedRestaurant ? <button className="text-link clear-menu" onClick={clearRestaurant}>See all restaurants <span aria-hidden="true">→</span></button> : <a href="#restaurants" className="text-link">Explore restaurants <span aria-hidden="true">→</span></a>}
          </div>
          <div className="food-categories" aria-label="Filter food by category">{foodCategories.map((item) => <button key={item.value} className={foodCategory === item.value ? 'food-category active' : 'food-category'} onClick={() => setFoodCategory(item.value)}>{item.label}</button>)}</div>
          {visibleFoods.length ? <div className="food-grid">{visibleFoods.map((food) => <FoodCard key={food.id} food={food} onAdd={addToCart} quantity={cart[food.id] || 0} />)}</div> : <div className="empty-results compact"><h3>No dishes match your search</h3><p>Try a different search, or clear the restaurant selection.</p><button onClick={() => { setSearch(''); setSelectedRestaurant(null); setFoodCategory('All') }}>Show popular food</button></div>}
        </section>

        <HowItWorks />
      </main>
      <Footer />
      {notice && <div className="toast" role="status">{notice}</div>}
      <CartDrawer open={cartOpen} items={cartItems} total={cartTotal} onClose={() => setCartOpen(false)} onUpdateQuantity={updateQuantity} />
    </div>
  )
}

export default App
