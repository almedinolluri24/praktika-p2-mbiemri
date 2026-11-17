import { ClockIcon } from './Icons.jsx'
import { useLanguage } from '../i18n/useLanguage.js'
import foodPlaceholder from '../assets/food-placeholder.svg'

export function FoodCard({ food, onAdd, quantity }) {
  const { t } = useLanguage()
  const imageUrl = food.image?.startsWith('http') || food.image?.startsWith('/') ? food.image : `https://images.unsplash.com/${food.image}?auto=format&fit=crop&w=700&q=80`
  const isAvailable = food.isAvailable !== false
  const canOrder = food.open && isAvailable

  return (
    <article className={`food-card ${!isAvailable ? 'sold-out' : ''}`}>
      <div className="food-photo">
        <img
          src={imageUrl}
          alt={food.name}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.onerror = null
            event.currentTarget.src = foodPlaceholder
          }}
        />
        <span className="food-category-label">{t(food.category)}</span>
        {!isAvailable && <span className="sold-out-badge">{t('E shitur')}</span>}
        {quantity > 0 && <span className="added-indicator">{t('{count} në shportë', { count: quantity })}</span>}
      </div>
      <div className="food-info">
        <div className="food-meta-top">
          <span className="food-restaurant">{food.restaurantName}</span>
          {food.prepMinutes > 0 && (
            <span className="food-prep-time">
              <ClockIcon size={12} />
              <span>{food.prepMinutes} min</span>
            </span>
          )}
        </div>
        <h3>{food.name}</h3>
        <p>{food.description}</p>
        {food.allergens && food.allergens.length > 0 && (
          <div className="food-allergens-tag" title={`${t('Alergjenët:')} ${food.allergens.join(', ')}`}>
            <small>{t('Alergjenët:')} {food.allergens.join(', ')}</small>
          </div>
        )}
        <div className="food-bottom">
          <strong>€{food.price.toFixed(2)}</strong>
          <button onClick={() => onAdd(food)} disabled={!canOrder} aria-label={`${t('Shto')} ${food.name} ${t('në shportë')}`}>
            <span aria-hidden="true">+</span> {!food.open ? t('Mbyllur') : !isAvailable ? t('E shitur') : food.optionGroups?.length ? t('Zgjidh opsionet') : t('Shto')}
          </button>
        </div>
      </div>
    </article>
  )
}
