# Raporti i auditimit dhe testeve

Kontrolluar më 15 nëntor 2026 kundrejt specifikimit të profesorit në PDF (v1.2, 10 nëntor 2026).
Stack-u: **React · Laravel · MySQL / SQLite**.

## Komandat dhe rezultatet e ekzekutimit

- `php artisan test` — **37 teste kaluan, 225 assertions** me sukses.
- `php artisan migrate:status` — të gjitha migrimet (përfshirë `2026_11_15_000009_add_pickup_instructions_to_branches`) janë ekzekutuar (`Ran`).
- `php artisan db:seed --no-interaction` — ekzekutohet pa asnjë gabim; popullohen 7 lloje biznesesh, 8 degë, 36 produkte me alergjenë të deklaruar, 6 grupe opsionesh me çmime shtesë, llogari me role dhe 15 porosi demo me të gjitha statuset.
- `npm run build` — **kaloi me sukses** (Vite: 69 module të transformuara në mënyrë optimale).
- `npm run lint` — **kaloi me sukses** (ESLint: 0 paralajmërime, 0 gabime).

## Mbulimi i plotë i skenarëve kritikë T01–T18

| ID | Skenari | Rezultati | Evidenca dhe zbatimi |
| --- | --- | --- | --- |
| **T01** | Kërkim dhe filtrim | **Përfunduar** | Kërkimi sipas emrit të restorantit ose produktit, filtrimi sipas llojit të biznesit (7 kategori), qytetit dhe statusit "Hapur tani" kryhen në backend në `PublicCatalogController`. |
| **T02** | Opsion i detyrueshëm mungon | **Përfunduar** | Serveri e refuzon porosinë me gabim validimi 422 kur mungon një grup opsioni i detyrueshëm ose tejkalohen kufijtë min/max. Testuar në `OrderLifecycleTest`. |
| **T03** | Manipulim i çmimit | **Përfunduar** | Totali dhe çmimet llogariten nga të dhënat e serverit dhe çmimet specifike të degës. Çmimi i manipuluar nga shfletuesi refuzohet ose mbishkruhet. Testuar në `OrderLifecycleTest`. |
| **T04** | Produkt shitet / çmimi ndryshon | **Përfunduar** | Nëse produkti është i padisponueshëm porosia refuzohet; nëse çmimi në meny ndryshon gjatë procesit, serveri kthen 409 Quote dhe kërkon rikonfirmimin e klientit. Testuar në `OrderLifecycleTest`. |
| **T05** | Klikim i dyfishtë ose retry | **Përfunduar** | Çelësi `Idempotency-Key` ruan fingerprint-in e kërkesës. Riprovimi i të njëjtit veprim kthen porosinë ekzistuese; kërkesë tjetër me të njëjtin çelës refuzohet me 409. |
| **T06** | Dy klientë kërkojnë vendin e fundit | **Përfunduar** | Testuar në `DemonstrationScenariosTest::test_t06_slot_capacity_permits_only_available_slots_and_rejects_overflow`. Kur kapaciteti i slotit mbushet, rezervimi i dytë refuzohet me 422. |
| **T07** | Kuzhina nis përgatitjen | **Përfunduar** | Statusi kalon në `preparing` dhe koha reale e fillimit ruhet. Ngjarja transmetohet në kanale private Reverb dhe klienti e sheh përditësimin pa rifreskim faqeje. |
| **T08** | Afati shtyhet me 10 minuta | **Përfunduar** | Testuar në `DemonstrationScenariosTest::test_t08_eta_can_be_postponed_and_creates_audited_history_and_notification`. Përditësohet `estimated_ready_at`, ruhet arsyeja dhe historiku në `order_eta_history` dhe `audit_logs`, dhe dërgohet njoftimi. |
| **T09** | Numërimi arrin zero | **Përfunduar** | Kur numërimi mbrapsht arrin zero, shfaqet teksti ekzakt i PDF-së: *“Afati i parashikuar ka kaluar; presim përditësim”*. Porosia nuk shpallet automatikisht "Gati" pa konfirmimin manual të stafit. |
| **T10** | Interneti shkëputet dhe rikthehet | **Përfunduar** | Ndërfaqja tregon gjendjen e lidhjes (`connected` / `connecting` / `offline`). Në rilidhje rimerret gjendja e plotë nga API dhe gjendjet nuk kthehen prapa. |
| **T11** | Akses te porosi e një tjetri | **Përfunduar** | Testuar në `DemonstrationScenariosTest::test_t11_cross_business_isolation_for_staff_and_customers`. Stafi i një restoranti nuk ka qasje në porositë e një dege tjetër (403/404); klienti sheh vetëm porositë e veta. |
| **T12** | Dy punonjës ndryshojnë statusin | **Përfunduar** | Testuar në `DemonstrationScenariosTest::test_t12_status_conflict_and_invalid_transition_handling`. Kalimet e statusit kontrollohen në DB me transaksione; nuk lejohen kapërcime ose kthime prapa të paligjshme. |
| **T13** | Skanim QR dy herë | **Përfunduar** | Tokeni i marrjes shënohet `pickup_code_used_at` dhe statusi bëhet `picked_up`. Çdo tentative e dytë për dorëzim refuzohet me 409/422. Testuar në `OrderLifecycleTest`. |
| **T14** | Artikull ende i papërfunduar | **Përfunduar** | Kalimi në statusin “Gati” bllokohet derisa çdo artikull në stacionet përkatëse të shënohet si i përfunduar dhe të konfirmohet paketimi. Testuar në `OrderLifecycleTest`. |
| **T15** | Anulim / refuzim | **Përfunduar** | Klienti anulon vetëm në pritje; menaxheri anulon/refuzon me arsye të detyrueshme. Anulimi liron menjëherë kapacitetin e slotit të rezervuar. Testuar në `OrderLifecycleTest`. |
| **T16** | Ndryshim produkti pas porosisë | **Përfunduar** | `order_items` dhe `order_item_options` ruajnë snapshot të emrit dhe çmimit në çastin e blerjes. Ndryshimi i emrit apo çmimit të produktit më vonë nuk prek porosinë historike. Testuar në `OrderLifecycleTest`. |
| **T17** | Rinisje serveri dhe rifreskim | **Përfunduar** | Testuar në `DemonstrationScenariosTest::test_t17_order_state_and_history_persist_in_database`. Të dhënat, afati, artikujt dhe historiku ruhen në mënyrë persistente në databazë. |
| **T18** | Pagesa ende e papaguar | **Përfunduar** | Statusi i pagesës ruhet veçmas (`unpaid` → `paid`). Dorëzimi dhe përdorimi i kodit refuzohen nëse stafi nuk ka regjistruar paraprakisht pagesën me para në dorë. Testuar në `OrderLifecycleTest`. |

## Verifikimi i të dhënave demo sipas PDF-së

- **7 lloje biznesesh**: Pizzeria (`Casa Forno`), Fast Food (`Urban Grill`), Kafe (`Moka House`), Furrë buke (`Daily Crumb`), Ushqim i shëndetshëm (`Green Table`), Restorant tradicional (`Bujtina Te Ura`), Ëmbëltore (`Sweet Atelier`).
- **Restorant me 2 degë**: `Casa Forno` ka `Casa Forno Center` dhe `Casa Forno East`.
- **Produkte & Alergjenë**: 36 produkte gjithsej me stacione kuzhine (`pizza`, `grill`, `oven`, `drinks`, `packaging`) dhe alergjenë të deklaruar realistë (`gluten`, `dairy`, `eggs`, `nuts`, `sesame`, `mustard`).
- **Grupe opsionesh**: 6 grupe me përzgjedhje min/max, zgjedhje të detyrueshme dhe çmime shtesë.
- **Raste kufitare**: Degë e mbyllur (p.sh. e hënë te Sweet Atelier), produkt i padisponueshëm (four-cheese-pizza te Casa Forno East), slot i plotë, dhe kod marrjeje tashmë i përdorur.
