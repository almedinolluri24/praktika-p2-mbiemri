import { useLanguage } from '../i18n/useLanguage.js'
import foodPlaceholder from '../assets/food-placeholder.svg'

export function RestaurantCard({ restaurant, onViewMenu }) {
  const { t } = useLanguage()
  const imageUrl = restaurant.image?.startsWith('http') || restaurant.image?.startsWith('/')
    ? restaurant.image
    : `https://images.unsplash.com/${restaurant.image}?auto=format&fit=crop&w=720&q=80`

  return (
    <article className="restaurant-card">
      <div className="restaurant-photo">
        <img
          src={imageUrl}
          alt={restaurant.name}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.onerror = null
            event.currentTarget.src = foodPlaceholder
          }}
        />
        {restaurant.featured && <span className="featured-label">{t('E PREFERUAR LOKALE')}</span>}
        <span className={restaurant.open ? 'open-label' : 'closed-label'}>
          <i></i>{t(restaurant.open ? 'Hapur tani' : 'Mbyllur')}
        </span>
      </div>
      <div className="restaurant-info">
        <div className="restaurant-title-row">
          <h3>{restaurant.name}</h3>
          {restaurant.rating && (
            <span className="rating">
              <span>★</span> {restaurant.rating}
            </span>
          )}
        </div>
        <p>{restaurant.description}</p>
        <div className="restaurant-meta">
          <span>{t(restaurant.cuisine)}</span>
          {restaurant.city && (
            <>
              <span className="meta-dot"></span>
              <span>{restaurant.city}</span>
            </>
          )}
          <span className="meta-dot"></span>
          <span>{t('Marrje: {time}', { time: restaurant.pickup || '15-25 min' })}</span>
        </div>
        <button className="view-menu-button" onClick={() => onViewMenu(restaurant)}>
          {t('Shiko menynë')} <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  )
}
