import { useEffect, useRef, useState } from 'react'
import { CameraIcon } from './Icons.jsx'
import { useLanguage } from '../i18n/useLanguage.js'

export function PickupScanner({ orderId, onDetected }) {
  const { t } = useLanguage()
  const videoRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return undefined
    let active = true
    let stream
    let frame
    const video = videoRef.current

    async function start() {
      if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
        setMessage('Skanimi QR nuk mbështetet nga ky shfletues. Vendosni kodin manualisht më poshtë.')
        return
      }
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (!active || !video) return
        video.srcObject = stream
        await video.play()
        setMessage('Drejtojeni kamerën drejt kodit QR të klientit.')
        const scan = async () => {
          if (!active || !video) return
          try {
            const codes = await detector.detect(video)
            const token = codes.find((code) => code.rawValue?.trim())?.rawValue?.trim()
            if (token) {
              onDetected(orderId, token)
              setMessage('Kodi QR u lexua me sukses! Verifikoni më poshtë.')
              setOpen(false)
              return
            }
          } catch {
            setMessage('Nuk u lexua kodi QR. Mbajeni drejt ose shkruani kodin numerik.')
          }
          frame = window.requestAnimationFrame(scan)
        }
        frame = window.requestAnimationFrame(scan)
      } catch {
        setMessage('Qasja në kamerë nuk u lejua. Vendosni kodin e marrjes manualisht.')
      }
    }

    start()
    return () => {
      active = false
      if (frame) window.cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
      if (video) video.srcObject = null
    }
  }, [open, orderId, onDetected])

  return (
    <div className="pickup-scanner">
      <button
        type="button"
        className="wolt-btn-secondary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        onClick={() => { setMessage(''); setOpen((current) => !current) }}
      >
        <CameraIcon size={15} />
        <span>{t(open ? 'Mbyll kamerën' : 'Skano QR të klientit')}</span>
      </button>
      {open && <video ref={videoRef} className="pickup-scanner-video" muted playsInline aria-label={t('Pamja e kamerës për skanimin e kodit QR')} />}
      {message && <small>{t(message)}</small>}
    </div>
  )
}
