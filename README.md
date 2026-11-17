# Foodora — platformë për porosi dhe marrje në restorant

Frontend React/Vite dhe API Laravel për shfletimin e restoranteve, konfigurimin e produkteve dhe porositë për marrje. Gjendja më poshtë bazohet në kodin dhe kontrollet e kryera më 17 nëntor 2026. PDF-ja e profesorit v1.2 është specifikimi funksional; pamjet Foodora janë referencë vizuale, jo provë funksionaliteti.

## Gjendja reale

- Katalogu dhe menytë ngarkohen nga Laravel API; kërkimi, biznesi, qyteti, hapur/të gjitha dhe kategoritë përdorin filtrat e API-së. Menuja për produktet e një restoranti dhe konfigurimi i opsioneve janë të lidhura.
- Seed demo: 7 lloje biznesesh, 7 restorante, 8 degë (Casa Forno ka 2 degë: Center dhe East), 36 produkte me alergjenë të deklaruar, 6 grupe opsionesh, 9 llogari demo dhe 15 porosi demo që mbulojnë të gjitha statuset dhe rastet kufitare (degë e mbyllur, slot i plotë, produkt i padisponueshëm, kod i përdorur).
- Sesion/CSRF, regjistrim vetëm klient, rivendosje fjalëkalimi vetëm me lidhje email-i njëpërdorimëshe, çaktivizim llogarie nga administratori, çmim nga serveri, konfirmim nëse shporta ndryshon çmim (409 Quote), idempotency, ASAP/orar i planifikuar me kapacitet atomik, statuset strikte, histori e plotë, ETA në UTC me histori të audituar, shënime të klientit, kuzhinë me stacione dhe progres artikujsh, pagesë cash e ndarë dhe token marrjeje njëpërdorimësh me QR kod në backend.
- React SPA responsive: zbulimi i restoranteve me filtra, profil i dedikuar restoranti me zgjedhje degësh dhe orare, meny me personalizim opsionesh dhe alergjenë, shportë me rregullin e një dege dhe shënime, gjurmim live me countdown të saktë sipas PDF-së («Afati i parashikuar ka kaluar; presim përditësim»), paraqitje e kodit dhe QR për klientin, si dhe panele të plota për Menaxherin, Kuzhinën, Pikën e Marrjes dhe Administratorin.
- API-ja dhe UI-ja e administratorit mbulojnë listimin/statusin e restoranteve, kategoritë, llogaritë (aktivizo/çaktivizo) dhe caktimin/heqjen e stafit në degë, me kontroll roli dhe audit log. Krijimi i restoranteve/degëve dhe menaxhimi i plotë i katalogut nga admini mungojnë.
- Reverb dhe Laravel Echo janë instaluar. Klienti dëgjon kanalin privat të porosive të veta, stafi dëgjon kanalet private të degëve të caktuara dhe UI rifreskon të dhënat kur lidhet/rilidhet. Autorizimi i kanalit kontrollohet në Laravel. Rrjedha është konfiguruar lokalisht, por performanca ≤5 sekonda dhe testimi në browser nuk janë provuar.
- Menaxheri mund të ngarkojë imazh produkti (JPG/PNG/WebP, maksimumi 5 MB); Laravel verifikon tipin dhe madhësinë. Duhet krijuar lidhja `public/storage` me `php artisan storage:link`.
- Pika e marrjes regjistron pagesën cash dhe verifikon kod/QR njëpërdorimësh. QR krijohet në shfletues; skanimi varet nga mbështetja `BarcodeDetector`, me kod manual si alternativë. Të dhënat demo deklarojnë alergjenë.
- Databaza lokale e zhvillimit dhe testet përdorin SQLite. Konfigurimi dhe PDO MySQL ekzistojnë, por MySQL nuk është ekzekutuar/testuar në këtë mjedis. Reverb dhe klienti për rilidhje janë implementuar, por demonstrimi real në tri pajisje dhe kufiri ≤5 sekonda nuk janë verifikuar.

Shih [auditimin e kërkesave](docs/PROJECT-AUDIT.md), [raportin e testeve](docs/TEST-REPORT.md) dhe [ER diagramin](docs/ER-DIAGRAM.md).

## Nisja lokale

### Backend (PowerShell)

```powershell
cd backend
Copy-Item .env.example .env
composer install
php artisan key:generate
php artisan reverb:install
php artisan storage:link
```

Vendos `DB_*` për MySQL ose SQLite në `.env`, pastaj ekzekuto migrimet dhe seed-in në databazë zhvillimi:

```powershell
php artisan migrate
php artisan db:seed
php artisan serve
```

Nise Reverb në një terminal të dytë nga `backend`:

```powershell
php artisan reverb:start
```

`php artisan reverb:install` gjeneron çelësa lokalë në `.env`. `.env.example` ka vetëm zëvendësues lokalë; mos i përdor si kredenciale prodhimi. Reverb përdor `localhost:8080` dhe Vite proxy-on kërkesën e autorizimit të kanaleve te Laravel.

Rivendosja e fjalëkalimit dërgon link me token të skaduar pas 60 minutash dhe që përdoret një herë. Në konfigurimin lokal `MAIL_MAILER=log`, linku shfaqet te `backend/storage/logs/laravel.log`; për dërgim real konfiguro SMTP në `.env`.

Seeder-i demo funksionon vetëm në `local` dhe `testing`. Parazgjedhja `DEMO_PASSWORD` merret nga `.env.example`; ndryshoje para se të përdorësh llogaritë në rrjet të përbashkët. Llogaritë demo:

| Roli | Email |
| --- | --- |
| Klient 1 / 2 | `test@example.com` / `customer2@example.com` |
| Menaxher | `manager@foodora.demo` / `manager.urban@foodora.demo` |
| Kuzhinë | `kitchen@foodora.demo` / `kitchen.urban@foodora.demo` |
| Marrje | `pickup@foodora.demo` / `pickup.urban@foodora.demo` |
| Administrator | vlera e `DEMO_ADMIN_EMAIL` (parazgjedhje: `admin@foodora.demo`) |

Dashboard-i i administratorit shfaqet vetëm për llogarinë që Laravel kthen me rolin `administrator`. Për ta përdorur email-in tënd lokalisht, ndrysho në `backend/.env` vlerat `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_NAME` dhe `DEMO_ADMIN_PASSWORD`, pastaj ekzekuto `php artisan db:seed --class=DatabaseSeeder` nga `backend`. Seeder-i punon vetëm në `local`/`testing`, përditëson llogarinë admin dhe nuk fshin databazën. Nëse vendos email tjetër, llogaria demo `admin@foodora.demo` bëhet `customer` gjatë seed-it; llogaria nuk fshihet. Mos dërgo fjalëkalimin në chat dhe mos përdor këto kredenciale për prodhim.

### Frontend

Në terminal tjetër:

```powershell
cd frontend
npm install
npm run dev
```

Vite dërgon `/api` te `http://127.0.0.1:8000`; backend-i duhet të jetë aktiv. Për prodhim përdor `npm run build`.

## API kryesore

- Publike: `GET /api/restaurants`, `GET /api/catalog/filters`, `GET /api/restaurants/{id}/branches`, `GET /api/branches/{id}/products`, `GET /api/branches/{id}/pickup-slots`.
- Sesion/profil: `GET /api/csrf-cookie`, `POST /api/register`, `POST /api/login`, `POST /api/forgot-password`, `POST /api/reset-password` (email + token), `GET /api/user`, `PATCH /api/profile`, `POST /api/logout`.
- Klient/porosi: `POST /api/orders` me `Idempotency-Key`, `branch_id`, `items`, `expected_total`, `schedule_type` dhe opsional `pickup_at`; `GET /api/orders`, `GET /api/orders/{id}`.
- Staf: status/ETA, `GET /api/kitchen/queue`, përfundim artikulli/paketimi, regjistrim pagese dhe `POST /api/orders/{id}/pickup`.
- Menaxher: `GET /api/manager/branches`, menu `GET/POST /api/manager/branches/{branch}/products`, `PATCH` për produktet, `GET/PUT .../hours`, dhe `GET .../reports`. Këto rrugë verifikojnë anëtarësinë e menaxherit në degë.
- Njoftime: `GET /api/notifications`, `POST /api/notifications/{id}/read`.
- Admin: `GET /api/admin/restaurants`, `PATCH /api/admin/restaurants/{id}/status`, kategori te `/api/admin/restaurants/{id}/categories`, llogaritë te `GET /api/admin/users` me aktivizim/çaktivizim përmes `PATCH /api/admin/users/{id}/status`, listim degësh/llogarish stafi dhe caktim/heqje stafi përmes `/api/admin/branches/{id}/staff`.
- Menaxher: `GET/POST/DELETE /api/manager/branches/{id}/staff` për stafin e kuzhinës/pickup-it në degët e autorizuara; menaxheri nuk mund të caktojë një degë tjetër.

API-të e mbrojtura përdorin sesion Laravel/CSRF dhe kontrollojnë rolin/degën në server. Gjendja e porosisë në API: `pending_confirmation → confirmed → preparing → ready → picked_up`; `rejected`/`cancelled` janë terminale dhe kërkojnë arsye sipas rregullit përkatës. `picked_up` është emri teknik për porosinë e përfunduar. Pagesa është vetëm cash në marrje; duhet regjistruar para se tokeni i marrjes të konsumohet.

## Verifikimi

Ekzekuto `php artisan test` nga `backend` dhe `npm run test:auth`, `npm run build` / `npm run lint` nga `frontend`. Rezultatet e fundit të verifikuara dhe kufijtë e provave T01–T18 janë në `docs/TEST-REPORT.md`.
