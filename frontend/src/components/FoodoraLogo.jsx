export function FoodoraLogo({ className = '' }) {
  return <span className={`foodora-logo ${className}`.trim()}>
    <svg className="foodora-logo-mark" viewBox="0 0 48 44" role="img" aria-label="Foodora plate and fork logo">
      <circle cx="31" cy="23" r="12" />
      <circle cx="31" cy="23" r="7" />
      <path d="M6 7v10M10 7v10M14 7v10M6 13h8M10 17v19" />
    </svg>
    <span className="foodora-wordmark"><strong>Foodora</strong><small>Your Food. Your Time.</small></span>
  </span>
}
