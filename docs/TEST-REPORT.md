# Raporti i testimit Foodora P2

Përditësuar më 17 nëntor 2026. Këto rezultate janë nga komandat e ekzekutuara në këtë workspace; backend testet përdorin SQLite in-memory. MySQL, shfletues real dhe WebSocket i nisur nuk janë pjesë e këtyre provave.

## Rezultatet e fundit

| Kontrolli | Rezultati |
| --- | --- |
| `php artisan test` nga `backend` | **42 kaluan, 251 assertions**, 0 dështime. |
| `npm run test:auth` nga `frontend` | **7 kaluan**, 0 dështime. Script-i përdor Node test API drejtpërdrejt për të mos kërkuar proces fëmijë. |
| `npm run build` nga `frontend` | **Kaloi**, 77 module Vite. |
| `npm run lint` nga `frontend` | **Kaloi**, pa gabime ESLint. |
| `php artisan migrate --force` në DB lokale | Migrimet 000010 dhe 000011 u aplikuan pa gabim; pa fshirje tabelash/të dhënash. |
| `php artisan migrate:status` | Migrimet e projektit u raportuan `Ran` në DB lokale SQLite. |
| MySQL | **Nuk u testua**; `database.default` lokal është `sqlite`. |
| Reverb/WebSocket live dhe responsive në browser | **Nuk u testuan manualisht**. |

## Mbulimi i skenarëve të PDF-së T01–T18

| ID | Skenari | Gjendja e provës |
| --- | --- | --- |
| T01 | Kërkim/filtrim, pagination | API teston kërkimin dhe llojin e biznesit; menuja teston pagination. Qyteti/hapur/sortimi i restoranteve nuk kanë test të dedikuar; MySQL nuk u përdor. **Pjesërisht** |
| T02 | Opsion i detyrueshëm mungon | Test backend refuzon opsionin/grupin e pavlefshëm. **Kaloi** |
| T03 | Manipulim çmimi | API rivlerëson çmimin dhe teston totalin nga serveri. **Kaloi** |
| T04 | Produkt shitet/çmimi ndryshon | Testet refuzojnë produktin joaktiv dhe verifikojnë përgjigjen 409 për ndryshim total. **Kaloi** |
| T05 | Double-click/retry | Idempotency kthen porosinë e parë dhe refuzon payload tjetër me të njëjtin key. Retry i njëkohshëm nuk u stres-testua. **Pjesërisht** |
| T06 | Dy klientë, sloti i fundit | Testet provojnë kapacitetin e mbushur me kërkesa sekuenciale; gara simultane në MySQL nuk u provua. **Pjesërisht** |
| T07 | Kuzhina nis përgatitjen | Kalimi/statusi dhe privatësia e kanalit testohen në backend; event live në Reverb nuk u pa nga klient real. **Pjesërisht** |
| T08 | ETA shtyhet 10 minuta | Testi provon ETA, historikun, arsyen, auditin dhe njoftimin e ruajtur. **Kaloi** |
| T09 | Countdown arrin zero | Testi provon se koha e kaluar nuk e ndryshon statusin automatikisht; UI mesazhi nuk u kontrollua në browser. **Pjesërisht** |
| T10 | Shkëputje dhe rilidhje | Kodi Echo rilidhet dhe rifreskon nga API; nuk u krye provë live me rrjet të shkëputur. **Pjesërisht** |
| T11 | Qasje ndërmjet restoranteve | Testet provojnë izolimin e stafit/klientit dhe autorizimin e kanaleve private. **Kaloi** |
| T12 | Dy punonjës ndryshojnë statusin | Testohen kalimet e palejuara dhe konfliktet pas gjendjes së fundit; kërkesa simultane nuk u stres-testua. **Pjesërisht** |
| T13 | QR skanohet dy herë | Testi provon se kodi i përdorur refuzohet; QR i dytë nuk mund ta përfundojë porosinë. **Kaloi** |
| T14 | Artikull i papërfunduar | Backend bllokon “Gati” deri te përfundimi i artikujve dhe paketimit. **Kaloi** |
| T15 | Anulim/refuzim | Testohen lejet, arsyet dhe lirimi i slotit në anulim. **Kaloi** |
| T16 | Menuja ndryshon pas porosisë | Testi verifikon snapshot-in e emrit dhe çmimit. **Kaloi** |
| T17 | Restart serveri/rifreskim | Testi provon leximin e gjendjes së ruajtur nga DB; procesi nuk u ndal/rinis në test. **Pjesërisht** |
| T18 | Pagesë e papaguar | API bllokon dorëzimin pa pagesë të saktë; teston pagesën dhe përfundimin. **Kaloi** |

## Prova të shtuara në këtë fazë

- Reset password kërkon tokenin e dërguar në email; tokeni skadon/përdoret një herë dhe email-i i panjohur merr përgjigje neutrale.
- Llogaria joaktive nuk mund të kyçet dhe një sesion ekzistues ndërpritet në kërkesën e radhës; admini nuk mund ta çaktivizojë veten.
- Imazhi produkti refuzon SVG dhe madhësi mbi 5 MB; JPG/PNG/WebP brenda limitit ruhen në diskun `public`.
- I njëjti produkt mund të jetë dy rreshta porosie me konfigurime të ndryshme dhe totalet llogariten veçmas.
- Seed/test konfirmon 7 lloje biznesesh, 8 degë, 36 produkte, 6 grupe opsionesh, 9 përdorues dhe 15 porosi.

## Çfarë duhet testuar para dorëzimit

1. Migro/seed nga databazë MySQL bosh dhe ekzekuto testet me MySQL.
2. Nise Laravel + Reverb + Vite; provo eventet dhe rilidhjen në pajisje/shfletues të ndarë, mat T07 brenda 5 sekondash.
3. Simulo kërkesa të njëkohshme për slotin e fundit, idempotency key të njëjtë dhe kalim statusi.
4. Kontrollo vizualisht desktop, tablet dhe telefon, tastierë, gabime rrjeti, menu bosh dhe llogari demo.
