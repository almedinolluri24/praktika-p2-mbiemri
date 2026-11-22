import { useState } from 'react'
import { FoodoraLogo } from './FoodoraLogo.jsx'
import { BackArrowIcon, MoonIcon, SunIcon } from './Icons.jsx'
import { login, register, requestPasswordReset, resetPassword, resendLoginCode, verifyLoginCode } from '../services/auth.js'
import { LanguageToggle } from '../i18n/LanguageToggle.jsx'
import { useLanguage } from '../i18n/useLanguage.js'
import './AuthPage.css'

export function LoginModal({ onClose, onSuccess, initialMode = 'login', isPage = false, theme = 'light', onToggleTheme }) {
  const { t } = useLanguage()
  const [mode, setMode] = useState(initialMode) // 'login' | 'register' | 'forgot' | 'reset' | 'verify'
  const [name, setName] = useState('')
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get('email') || '')
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('reset_token') || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [verificationAction, setVerificationAction] = useState('login')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccessMsg('')
    setSubmitting(true)
    try {
      if (mode === 'forgot') {
        const res = await requestPasswordReset({ email })
        setSuccessMsg(res.message || 'Nëse ekziston llogaria, do të dërgohet një lidhje për rivendosjen e fjalëkalimit.')
      } else if (mode === 'reset') {
        const res = await resetPassword({ email, token: resetToken, password, passwordConfirmation })
        setSuccessMsg(res.message || 'Fjalëkalimi u ndryshua me sukses!')
        setMode('login')
        setPassword('')
        setPasswordConfirmation('')
        window.history.replaceState({}, '', '/')
      } else if (mode === 'register') {
        const result = await register({ name, email, password, passwordConfirmation })
        setVerificationAction('register')
        setVerificationEmail(result.email || email)
        setVerificationCode('')
        setPassword('')
        setPasswordConfirmation('')
        setSuccessMsg(result.message || 'Kodi i verifikimit u dërgua në email-in tënd.')
        setMode('verify')
      } else if (mode === 'verify') {
        const user = await verifyLoginCode({ code: verificationCode })
        onSuccess(user, verificationAction)
        onClose()
      } else {
        const result = await login({ email, password, remember })
        setVerificationAction('login')
        setVerificationEmail(result.email || email)
        setVerificationCode('')
        setPassword('')
        setSuccessMsg(result.message || 'Kodi i verifikimit u dërgua në email-in tënd.')
        setMode('verify')
      }
    } catch (authError) {
      setError(t(authError.message))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResendCode() {
    setSubmitting(true)
    setError('')
    setSuccessMsg('')
    try {
      const result = await resendLoginCode()
      setSuccessMsg(result.message)
    } catch (authError) {
      setError(t(authError.message))
    } finally {
      setSubmitting(false)
    }
  }

  const registering = mode === 'register'
  const resetting = mode === 'reset'
  const forgetting = mode === 'forgot'
  const verifying = mode === 'verify'

  return (
    <div
      className={isPage ? 'auth-page' : 'login-backdrop'}
      onMouseDown={(event) => { if (!isPage && event.target === event.currentTarget) onClose() }}
    >
      {isPage && (
        <header className="auth-page-header">
          <FoodoraLogo />
          <div className="auth-page-actions">
          <LanguageToggle />
            {onToggleTheme && (
              <button
                type="button"
                className="auth-theme-toggle"
                onClick={onToggleTheme}
                aria-label={t(theme === 'dark' ? 'Kalo në temën e çelët' : 'Kalo në temën e errët')}
                title={t(theme === 'dark' ? 'Kalo në temën e çelët' : 'Kalo në temën e errët')}
              >
                {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
              </button>
            )}
            <button type="button" className="auth-page-back" onClick={onClose} aria-label={t('Kthehu te ballina')}>
              <BackArrowIcon size={15} />
              <span className="auth-back-label">{t('Kthehu te ballina')}</span>
            </button>
          </div>
        </header>
      )}

      {isPage && (
        <section className="auth-page-promo" aria-label={t('Mirë se vini në Foodora')}>
          <span>{t('USHQIM I MIRË, PA PRITJE TË GJATA')}</span>
          <h1>{t('Shijo më shumë.')}<br /><strong>{t('Prit më pak.')}</strong></h1>
          <p>{t('Kyçu ose krijo llogarinë tënde për të porositur nga restorantet e preferuara dhe për të ndjekur porositë.')}</p>
        </section>
      )}

      <section
        className={`login-dialog foodora-auth-card ${isPage ? 'auth-page-card' : ''}`}
        role={isPage ? undefined : 'dialog'}
        aria-modal={isPage ? undefined : true}
        aria-labelledby="login-title"
      >
        {!isPage && <button className="login-close" type="button" onClick={onClose} aria-label={t('Mbyll dritaren')}>×</button>}

        <div className="foodora-auth-header">
          {!isPage && <FoodoraLogo className="login-logo" />}
          <h2 id="login-title">
            {t(verifying ? 'Verifikoni kodin e email-it' : resetting ? 'Vendos fjalëkalim të ri' : forgetting ? 'Rivendos fjalëkalimin' : registering ? 'Krijo llogari të re' : 'Mirë se vini në Foodora')}
          </h2>
          <p className="login-intro">
            {verifying
              ? t('Kodi i verifikimit u dërgua në {email}. Shkruaje kodin për të përfunduar kyçjen.', { email: verificationEmail })
              : resetting
              ? t('Zgjidhni fjalëkalim të ri për llogarinë tuaj.')
              : forgetting
              ? t('Do t’ju dërgojmë një lidhje të sigurt në email për ta rivendosur fjalëkalimin.')
              : registering
              ? t('Regjistrohuni për të bërë porosi me marrje në restorant.')
              : t('Hyni në llogarinë tuaj për të porositur dhe ndjekur përgatitjen.')}
          </p>

          {!(resetting || forgetting || verifying) && (
            <div className="foodora-tab-switch" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={!registering}
                className={`foodora-tab-btn ${!registering ? 'active' : ''}`}
                onClick={() => { setError(''); setSuccessMsg(''); setMode('login') }}
              >
                {t('Kyçu')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={registering}
                className={`foodora-tab-btn ${registering ? 'active' : ''}`}
                onClick={() => { setError(''); setSuccessMsg(''); setMode('register') }}
              >
                {t('Regjistrohu')}
              </button>
            </div>
          )}
        </div>

        {successMsg && (
          <div className="foodora-alert success" role="status" style={{ marginBottom: '14px' }}>
            ✓ {t(successMsg)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="foodora-auth-form">
          {registering && (
            <div className="foodora-form-group">
              <label htmlFor="register-name">{t('Emri dhe mbiemri')}</label>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                placeholder={t('p.sh. Agim Berisha')}
                required
                autoFocus
              />
            </div>
          )}

          {!resetting && !verifying && (
          <div className="foodora-form-group">
            <label htmlFor="login-email">{t('Adresa e email-it')}</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('emri@example.com')}
              required
            />
          </div>
          )}

          {!forgetting && !verifying && (
          <div className="foodora-form-group">
            <div className="foodora-password-label-row">
              <label htmlFor="login-password">{t(resetting ? 'Fjalëkalimi i ri' : 'Fjalëkalimi')}</label>
              {mode === 'login' && (
                <button
                  type="button"
                  className="forgot-password-toggle"
                  onClick={() => { setError(''); setSuccessMsg(''); setMode('forgot') }}
                >
                  {t('Harruat fjalëkalimin?')}
                </button>
              )}
            </div>
            <div className="foodora-password-input-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={registering || resetting ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t(registering || resetting ? 'Së paku 8 karaktere' : 'Fjalëkalimi juaj')}
                minLength={registering || resetting ? 8 : undefined}
                required
              />
              <button
                type="button"
                className="password-visibility-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={t(showPassword ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin')}
                aria-pressed={showPassword}
              >
                {t(showPassword ? 'Fshih' : 'Shfaq')}
              </button>
            </div>
          </div>
          )}

          {verifying && (
            <div className="foodora-form-group">
              <label htmlFor="login-verification-code">{t('Kodi i verifikimit')}</label>
              <input
                id="login-verification-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                minLength={6}
                maxLength={6}
                pattern="[0-9]{6}"
                required
                autoFocus
              />
            </div>
          )}

          {(registering || resetting) ? (
            <div className="foodora-form-group">
              <label htmlFor="register-confirm-password">{t('Konfirmo fjalëkalimin')}</label>
              <input
                id="register-confirm-password"
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                minLength={8}
                placeholder={t('Përsërit fjalëkalimin')}
                required
              />
            </div>
          ) : mode === 'login' ? (
            <label className="remember-label">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              {t('Më mbaj të kyçur në këtë pajisje')}
            </label>
          ) : null}

          {error && <div className="login-error" role="alert">⚠️ {t(error)}</div>}

          <button className="login-submit foodora-btn-primary" type="submit" disabled={submitting}>
            {t(submitting ? 'Ju lutem prisni…' : verifying ? 'Verifiko kodin dhe kyçu' : resetting ? 'Ruaj fjalëkalimin e ri' : forgetting ? 'Dërgo lidhjen e rivendosjes' : registering ? 'Krijo llogarinë' : 'Vazhdo')}
          </button>
        </form>

        <div className="foodora-auth-footer">
          {verifying ? (
            <>
              <button className="auth-mode-toggle" type="button" onClick={handleResendCode} disabled={submitting}>
                {t('Dërgo kodin përsëri')}
              </button>
              <button className="auth-mode-toggle" type="button" onClick={() => { setError(''); setSuccessMsg(''); setMode('login') }}>
                {t('← Kthehu te kyçja')}
              </button>
            </>
          ) : (resetting || forgetting) ? (
            <button
              className="auth-mode-toggle"
              type="button"
              onClick={() => { setError(''); setSuccessMsg(''); setMode('login') }}
            >
              {t('← Kthehu te kyçja')}
            </button>
          ) : (
            <button
              className="auth-mode-toggle"
              type="button"
              onClick={() => { setError(''); setSuccessMsg(''); setMode(registering ? 'login' : 'register') }}
            >
              {t(registering ? 'Keni llogari? Kyçuni këtu' : 'I ri në Foodora? Regjistrohuni falas')}
            </button>
          )}
          {registering && (
            <small className="login-demo-note">
              {t('Regjistrimi publik krijon llogari klienti. Rolet e stafit caktohen nga menaxheri ose administratori.')}
            </small>
          )}
        </div>
      </section>
    </div>
  )
}
