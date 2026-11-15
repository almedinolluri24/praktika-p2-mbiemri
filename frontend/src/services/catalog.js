const restaurantImages = {
  pizzeria: 'photo-1513104890138-7c749659a591',
  fast_food: 'photo-1550547660-d9450f859349',
  cafe: 'photo-1495474472287-4d71bcdd2085',
  bakery: 'photo-1509440159596-0249088772ff',
  healthy_kitchen: 'photo-1512621776951-a57141f2eefd',
  traditional_restaurant: 'photo-1555396273-367ea4eb4db5',
  sweet_shop: 'photo-1551024709-8f23befc6f87',
}

const productImages = {
  pizza: 'photo-1574071318508-1cdbab80d002',
  burger: 'photo-1568901346375-23c9450c58cd',
  pasta: 'photo-1473093295043-cdd812d0e601',
  bowl: 'photo-1546069901-ba9599a7e63c',
  sushi: 'photo-1579871494447-9811cf80d66c',
  coffee: 'photo-1495474472287-4d71bcdd2085',
  bakery: 'photo-1509440159596-0249088772ff',
  traditional: 'photo-1555396273-367ea4eb4db5',
  dessert: 'photo-1551024709-8f23befc6f87',
  default: 'photo-1546549032-9571cd6b27df',
}

const cuisineLabels = {
  pizzeria: 'Italian',
  fast_food: 'Burgers',
  cafe: 'Cafe',
  bakery: 'Bakery',
  healthy_kitchen: 'Healthy',
  traditional_restaurant: 'Traditional',
  sweet_shop: 'Desserts',
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Could not load the restaurant catalog. Make sure the Laravel server is running.')
  return response.json()
}

function imageForProduct(product) {
  const text = `${product.name} ${product.category?.name || ''}`.toLowerCase()
  if (/pizza|crust/.test(text)) return productImages.pizza
  if (/burger|fries|wrap/.test(text)) return productImages.burger
  if (/pasta|penne/.test(text)) return productImages.pasta
  if (/bowl|salad|smoothie|oats/.test(text)) return productImages.bowl
  if (/sushi|salmon|poke/.test(text)) return productImages.sushi
  if (/coffee|latte|espresso/.test(text)) return productImages.coffee
  if (/muffin|bread|pastry|borek|focaccia/.test(text)) return productImages.bakery
  if (/flija|tavë|kosi|peppers|traditional/.test(text)) return productImages.traditional
  if (/baklava|cheesecake|tart|brownie|dessert|cake/.test(text)) return productImages.dessert
  return productImages.default
}

export function formatFoodItem(product, restaurant, branch, index = 0) {
  return {
    id: product.id,
    productId: product.id,
    restaurantId: restaurant.id,
    branchId: branch.id,
    restaurantName: restaurant.name,
    name: product.name,
    description: product.description || '',
    category: product.category?.name || 'Other',
    categoryId: product.category_id,
    allergens: Array.isArray(product.allergens) ? product.allergens : [],
    prepMinutes: Number(product.prep_minutes) || 15,
    prepStation: product.prep_station || 'packaging',
    price: Number(product.pivot?.price_override ?? product.price),
    image: product.image_path || imageForProduct(product),
    popular: index < 2,
    open: branch.is_open_now ?? true,
    isAvailable: product.pivot?.is_available !== false && product.is_available !== false,
    optionGroups: (product.option_groups || []).map((group) => ({
      id: group.id,
      name: group.name,
      required: group.is_required,
      minSelections: group.is_required ? Math.max(1, Number(group.min_selections)) : Number(group.min_selections),
      maxSelections: Number(group.max_selections),
      options: (group.options || []).map((option) => ({
        id: option.id,
        name: option.name,
        priceDelta: Number(option.price_delta),
      })),
    })),
  }
}

export async function loadCatalog({ searchText = '', businessType = '', category = '', city = '', openOnly = false, restaurantId = null, selectedBranchId = null } = {}) {
  const allRestaurantsPage = await getJson('/api/restaurants?per_page=50')
  const restaurantParams = new URLSearchParams({ per_page: '50' })
  if (searchText) restaurantParams.set('search', searchText)
  if (businessType) restaurantParams.set('business_type', businessType)
  if (city) restaurantParams.set('city', city)
  if (openOnly) restaurantParams.set('open_only', '1')
  const matchingRestaurantsPage = await getJson(`/api/restaurants?${restaurantParams}`)
  const restaurantIds = new Set(matchingRestaurantsPage.data.map((restaurant) => restaurant.id))
  const entries = await Promise.all(allRestaurantsPage.data.map(async (restaurant) => {
    if (restaurantId && restaurant.id !== restaurantId) return null
    const branches = await getJson(`/api/restaurants/${restaurant.id}/branches`)
    if (!branches.length) return null

    const branch = (selectedBranchId && branches.find((b) => b.id === Number(selectedBranchId))) || branches[0]
    if (!branch) return null

    const productParams = new URLSearchParams({ per_page: '50' })
    if (searchText) productParams.set('search', searchText)
    if (category) productParams.set('category', category)
    const productsPage = await getJson(`/api/branches/${branch.id}/products?${productParams}`)
    const prepTimes = productsPage.data.map((product) => Number(product.prep_minutes)).filter((minutes) => minutes > 0)
    const restaurantView = {
      id: restaurant.id,
      name: restaurant.name,
      cuisine: cuisineLabels[restaurant.business_type] || restaurant.business_type,
      description: restaurant.description || 'Fresh local food, ready for pickup.',
      rating: null,
      pickup: prepTimes.length ? `${Math.min(...prepTimes)}–${Math.max(...prepTimes)} min` : '15–30 min',
      open: branch.is_open_now ?? true,
      image: restaurant.image_path || restaurantImages[restaurant.business_type] || restaurantImages.cafe,
      featured: restaurant.business_type === 'pizzeria',
      branchId: branch.id,
      city: branch.city,
      address: branch.address,
      phone: branch.phone,
      pickupInstructions: branch.pickup_instructions,
      businessType: restaurant.business_type,
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        address: b.address,
        phone: b.phone,
        pickupInstructions: b.pickup_instructions,
        isOpenNow: b.is_open_now ?? true,
        businessHours: b.business_hours || [],
      })),
    }
    const foods = productsPage.data.map((product, index) => formatFoodItem(product, restaurant, branch, index))
    return { restaurant: restaurantView, foods }
  }))

  return {
    restaurants: entries.filter((entry) => entry && restaurantIds.has(entry.restaurant.id)).map((entry) => entry.restaurant),
    foods: entries.filter(Boolean).flatMap((entry) => entry.foods),
  }
}

export async function loadBranchProducts(branchId, { searchText = '', category = '', page = 1, perPage = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
  if (searchText) params.set('search', searchText)
  if (category && category !== 'All') params.set('category', category)
  return getJson(`/api/branches/${branchId}/products?${params.toString()}`)
}

export async function loadCatalogFilters() {
  return getJson('/api/catalog/filters')
}
