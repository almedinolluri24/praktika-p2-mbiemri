# Foodora frontend

Ndërfaqja React/Vite ngarkon restorantet, menytë dhe filtrat nga Laravel API dhe përdor shportë lokale deri në dorëzimin e porosisë.

Për instalim dhe nisje, ndiq [README kryesor](../README.md). Vite kërkon backend-in në `http://127.0.0.1:8000` dhe përcjell kërkesat `/api`.

Komandat lokale: `npm run dev`, `npm run test:auth`, `npm run build`, `npm run lint`. Testet `test:auth` kontrollojnë destinacionin pas login-it për administratorin, stafin dhe klientin, si dhe sigurojnë që regjistrimi i klientit nuk hap panel të privilegjuar. UI përfshin historikun/ETA të klientit, panelet e stafit/adminit, Reverb live dhe menaxhimin e caktimit të stafit.
