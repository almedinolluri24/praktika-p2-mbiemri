import { useMemo, useState } from 'react'
import { AlertTriangleIcon } from './Icons.jsx'
import { useLanguage } from '../i18n/useLanguage.js'
import { LanguageToggle } from '../i18n/LanguageToggle.jsx'
import './ProductOptionsModal.css'

export function ProductOptionsModal({ food, onClose, onAdd }) {
  const { t } = useLanguage()
  const [selected, setSelected] = useState({})
  const selectedIds = useMemo(() => Object.values(selected).flat(), [selected])
  const valid = food.optionGroups.every((group) => {
    const count = selected[group.id]?.length || 0
    return count >= group.minSelections && count <= group.maxSelections
  })
  const extra = food.optionGroups.flatMap((group) => group.options)
    .filter((option) => selectedIds.includes(option.id))
    .reduce((total, option) => total + option.priceDelta, 0)

  function toggle(group, option) {
    setSelected((current) => {
      const existing = current[group.id] || []
      const next = existing.includes(option.id)
        ? existing.filter((id) => id !== option.id)
        : group.maxSelections === 1
          ? [option.id]
          : existing.length < group.maxSelections ? [...existing, option.id] : existing
      return { ...current, [group.id]: next }
    })
  }

  return (
    <div className="options-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="options-dialog" role="dialog" aria-modal="true" aria-labelledby="options-title">
        <LanguageToggle />
        <button className="options-close" onClick={onClose} aria-label={t('Mbyll opsionet')}>×</button>
        <span className="section-kicker">{t('PERSONALIZONI POROSINË TUAJ')}</span>
        <h2 id="options-title">{food.name}</h2>
        <p className="options-intro">{food.description || t('Përzgjidhni opsionet e dëshiruara para se ta shtoni pjatën në shportë.')}</p>
        {food.allergens && food.allergens.length > 0 && (
          <p className="options-allergens" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '6px 0 14px', fontSize: '11px', color: '#c2410c' }}>
            <AlertTriangleIcon size={14} />
            <span><strong>{t('Alergjenët e deklaruar:')}</strong> {food.allergens.join(', ')}</span>
          </p>
        )}
        <div className="option-groups">
          {food.optionGroups.map((group) => (
            <fieldset className="option-group" key={group.id}>
              <legend>
                {group.name}
                <small>{group.minSelections ? t('Zgjidhni të paktën {count}', { count: group.minSelections }) : t('Opsionale')} · {t('deri në')} {group.maxSelections}</small>
              </legend>
              {group.options.map((option) => {
                const checked = selected[group.id]?.includes(option.id) || false
                return (
                  <label className="option-choice" key={option.id}>
                    <input
                      type={group.maxSelections === 1 ? 'radio' : 'checkbox'}
                      name={`group-${group.id}`}
                      checked={checked}
                      onChange={() => toggle(group, option)}
                    />
                    <span>{option.name}</span>
                    <strong>{option.priceDelta > 0 ? `+€${option.priceDelta.toFixed(2)}` : t('Përfshirë')}</strong>
                  </label>
                )
              })}
            </fieldset>
          ))}
        </div>
        <button className="options-add" disabled={!valid} onClick={() => onAdd(selectedIds)}>
          {t('Shto në shportë')} · €{(food.price + extra).toFixed(2)}
        </button>
        {!valid && (
          <small className="options-validation" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangleIcon size={13} /> {t('Ju lutem përzgjidhni opsionet e kërkuara për të vazhduar.')}
          </small>
        )}
      </section>
    </div>
  )
}
