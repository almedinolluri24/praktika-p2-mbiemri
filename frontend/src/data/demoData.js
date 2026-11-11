export const demoRestaurants = [
  { id: 'oliva', name: 'Oliva Kitchen', cuisine: 'Italian', description: 'Handmade pasta & wood-fired pizza', rating: 4.8, pickup: '15–25 min', open: true, image: 'photo-1513104890138-7c749659a591', featured: true },
  { id: 'grillhouse', name: 'The Grill House', cuisine: 'Burgers', description: 'Smash burgers made with local beef', rating: 4.7, pickup: '20–30 min', open: true, image: 'photo-1550547660-d9450f859349' },
  { id: 'sakura', name: 'Sakura Bowl', cuisine: 'Asian', description: 'Fresh sushi, ramen & rice bowls', rating: 4.9, pickup: '20–35 min', open: true, image: 'photo-1579871494447-9811cf80d66c' },
  { id: 'greenfork', name: 'The Green Fork', cuisine: 'Healthy', description: 'Colorful salads & nourishing bowls', rating: 4.6, pickup: '10–20 min', open: true, image: 'photo-1512621776951-a57141f2eefd' },
  { id: 'taco', name: 'Casa del Taco', cuisine: 'Mexican', description: 'Street-style tacos & fresh salsa', rating: 4.8, pickup: '15–25 min', open: false, image: 'photo-1551504734-5ee1c4a1479b' },
  { id: 'littleoven', name: 'Little Oven', cuisine: 'Italian', description: 'Comfort food, baked fresh daily', rating: 4.5, pickup: '25–35 min', open: true, image: 'photo-1574071318508-1cdbab80d002' },
]

export const demoFoods = [
  { id: 'marg', restaurantId: 'oliva', restaurantName: 'Oliva Kitchen', name: 'Burrata Margherita', description: 'San Marzano tomato, creamy burrata & basil.', category: 'Pizza', price: 12.5, image: 'photo-1579751626657-72bc17010498', popular: true },
  { id: 'pasta', restaurantId: 'oliva', restaurantName: 'Oliva Kitchen', name: 'Creamy Truffle Pasta', description: 'Fresh tagliatelle with parmesan & truffle.', category: 'Pasta', price: 14, image: 'photo-1473093295043-cdd812d0e601', popular: false },
  { id: 'smash', restaurantId: 'grillhouse', restaurantName: 'The Grill House', name: 'Classic Smash Burger', description: 'Double smashed beef, cheddar & house sauce.', category: 'Burgers', price: 11.5, image: 'photo-1568901346375-23c9450c58cd', popular: true },
  { id: 'fries', restaurantId: 'grillhouse', restaurantName: 'The Grill House', name: 'Parmesan Truffle Fries', description: 'Crispy fries, parmesan & truffle mayo.', category: 'Sides', price: 5.5, image: 'photo-1573080496219-bb080dd4f877', popular: false },
  { id: 'salmon', restaurantId: 'sakura', restaurantName: 'Sakura Bowl', name: 'Salmon Poke Bowl', description: 'Sushi rice, salmon, avocado & sesame.', category: 'Bowls', price: 13.5, image: 'photo-1546069901-ba9599a7e63c', popular: true },
  { id: 'rolls', restaurantId: 'sakura', restaurantName: 'Sakura Bowl', name: 'Crispy Salmon Rolls', description: 'Eight pieces with salmon, cucumber & spicy mayo.', category: 'Sushi', price: 12, image: 'photo-1579871494447-9811cf80d66c', popular: false },
  { id: 'green', restaurantId: 'greenfork', restaurantName: 'The Green Fork', name: 'Green Goddess Bowl', description: 'Avocado, quinoa, greens & lemon tahini.', category: 'Bowls', price: 10.5, image: 'photo-1512621776951-a57141f2eefd', popular: true },
  { id: 'tacos', restaurantId: 'taco', restaurantName: 'Casa del Taco', name: 'Baja Fish Tacos', description: 'Crispy fish, lime slaw & chipotle crema.', category: 'Tacos', price: 11, image: 'photo-1551504734-5ee1c4a1479b', popular: true },
  { id: 'oven', restaurantId: 'littleoven', restaurantName: 'Little Oven', name: 'Prosciutto e Rucola', description: 'Thin crust, prosciutto, rocket & parmesan.', category: 'Pizza', price: 13, image: 'photo-1574071318508-1cdbab80d002', popular: false },
]

export const foodCategories = ['All', 'Pizza', 'Burgers', 'Pasta', 'Bowls', 'Sushi', 'Tacos', 'Sides']
