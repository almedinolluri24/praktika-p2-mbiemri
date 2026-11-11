const steps = [
  { number: '01', icon: '⌕', title: 'Choose a restaurant', description: 'Browse the best local spots and find exactly what you are craving.' },
  { number: '02', icon: '♧', title: 'Select your food', description: 'Build your order from a menu of fresh, made-to-order favorites.' },
  { number: '03', icon: '↗', title: 'Pick up your order', description: 'Head over when it is ready and skip the wait. It is that simple.' },
]

export function HowItWorks() {
  return <section className="how-section" id="how-it-works"><div className="section centered-heading"><span className="section-kicker">THREE STEPS TO DELICIOUS</span><h2>Good food, <span>made simple</span></h2><p>Your next great meal is just around the corner.</p><div className="steps-grid">{steps.map((step) => <article className="step-card" key={step.number}><span className="step-number">{step.number}</span><span className="step-icon" aria-hidden="true">{step.icon}</span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div></div></section>
}
