import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useLanguage } from '../i18n/useLanguage.js'

export function PickupQr({ value }) {
  const { t } = useLanguage()
  const [result, setResult] = useState({ value: '', image: '', error: false })

  useEffect(() => {
    let active = true
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 176,
      color: { dark: '#171717', light: '#ffffff' },
    }).then((dataUrl) => {
      if (active) setResult({ value, image: dataUrl, error: false })
    }).catch(() => {
      if (active) setResult({ value, image: '', error: true })
    })
    return () => { active = false }
  }, [value])

  if (result.value === value && result.error) {
    return <p className="pickup-qr-error" role="status">{t('Kodi QR nuk është i disponueshëm. Përdorni kodin numerik më poshtë.')}</p>
  }
  return result.value === value && result.image ? (
    <img className="pickup-qr" src={result.image} alt={t('Kodi QR i marrjes së porosisë')} width="176" height="176" />
  ) : (
    <span className="pickup-qr-loading" role="status">{t('Po përgatitet kodi QR…')}</span>
  )
}
