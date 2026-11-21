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

const namedProductImages = [
  [/almond croissant/, 'photo-1618111415112-793c80d2fb3b'],
  [/blueberry muffin|muffin/, 'photo-1637087788517-c63086ec5b7e'],
  [/butter croissant|croissant/, 'photo-1725545901708-27d59e5c4226'],
  [/focaccia/, 'photo-1767065888111-7ca2b12d4944'],
  [/sourdough loaf|sourdough/, 'photo-1675725291010-cb1020860cb2'],
  [/spinach feta borek|spinach.*borek|borek/, 'https://img.godt.no/w4000/plain/recipes/9d/9d9ca945-0a36-4542-b4e3-c23b36fc8189'],
  [/bbq bacon burger|hamburger me proshutë dhe bbq|hamburger me proshutë/, 'photo-1561758033-f8ff74d6494a'],
  [/classic smash burger|hamburger klasik smash/, 'photo-1568901346375-23c9450c58cd'],
  [/crispy chicken burger|hamburger me pulë të skuqur/, 'photo-1671106571674-a89083d27e60'],
  [/grilled chicken wrap|roll me pulë të pjekur në skarë/, 'photo-1626700051175-6818013e1d4f'],
  [/onion rings|unaza qepësh/, 'photo-1645066804048-080d5fe87ae3'],
  [/truffle fries|patate të skuqura me tartuf/, 'photo-1534938665420-4193effeacc4'],
  [/four cheese|quattro formaggi/, 'photo-1574071318508-1cdbab80d002'],
  [/margherita/, 'photo-1627626775846-122b778965ae'],
  [/pepperoni/, 'photo-1578301807752-33631801f8aa'],
  [/garlic bread/, 'photo-1556008531-57e6eefc7be4'],
  [/penne alfredo|alfredo pasta/, 'photo-1662197480393-2a82030b7b83'],
  [/tiramisu/, 'photo-1782503708390-4e5fff098d57'],
  [/avocado toast/, 'photo-1603046891743-0f28d1192132'],
  [/cappuccino/, 'photo-1522210338192-67c5905429d6'],
  [/chocolate brownie|brownie/, 'photo-1612078960206-1709f1f0c969'],
  [/cinnamon roll/, 'photo-1668015826833-9aeafb608ccd'],
  [/cold brew/, 'photo-1581996323441-538096e854b9'],
  [/iced latte/, 'photo-1584286595398-a59f21d313f5'],
  [/fruit tart|tart/, 'photo-1768236360396-0f131beb3028'],
  [/pistachio baklava|baklava/, 'photo-1676014959543-81df1079b423'],
  [/vanilla cheesecake|cheesecake/, 'photo-1524351199678-941a58a3df50'],
  [/chicken caesar|caesar salad/, 'photo-1643013911400-40bb4f2a92ce'],
  [/green goddess/, 'photo-1512621776951-a57141f2eefd'],
  [/rainbow buddha|buddha bowl/, 'photo-1540420773420-3366772f4999'],
  [/hummus|veggie box/, 'photo-1695835394238-d3367fa34b45'],
  [/mango smoothie|smoothie/, 'photo-1704881661177-7747fe663400'],
  [/overnight oats|oatmeal|porridge/, 'photo-1650265929273-00c7ac3cb0e7'],
]

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
  const name = product.name.toLowerCase()
  const namedImage = namedProductImages.find(([pattern]) => pattern.test(name))?.[1]
  if (namedImage) return namedImage

  const text = `${name} ${product.category?.name || ''}`.toLowerCase()
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
