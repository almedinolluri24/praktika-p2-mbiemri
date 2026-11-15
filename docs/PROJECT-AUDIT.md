# Auditimi P2 sipas specifikimit të profesorit

Burimi kryesor: `Projekti-02-Platforma-e-porosive-ne-restorante.pdf`, versioni 1.2, i datës 10 nëntor 2026. Përditësuar më 15 nëntor 2026.

| Kërkesa e dokumentit | Gjendja | Detajet e zbatimit |
| --- | --- | --- |
| **Stack React, Laravel API, MySQL / SQLite** | **Përfunduar** | Arkitekturë e plotë full stack. Laravel API me autorizim sipas roleve, transaksione DB dhe migrime; React SPA responsive me ndërfaqe moderne; mbështetje për MySQL përmes `.env.example` dhe SQLite për zhvillim lokal dhe teste. |
| **Vizitori shfleton/kërkon pa llogari** | **Përfunduar** | Kërkim i plotë i restoranteve dhe artikujve të ushqimit, filtrimi sipas llojit të biznesit, qytetit dhe statusit "Hapur tani". Profil i dedikuar restoranti me përzgjedhje degësh, orare javore, kontakt dhe udhëzime marrjeje. |
| **Klienti menaxhon profilin dhe ndjek porositë** | **Përfunduar** | Klienti krijon llogari, bën porosi, ndjek statusin live (ETA, countdown, historik, koha reale e fillimit të përgatitjes, kodi dhe QR i marrjes, udhëzimet për marrje), dhe mund të anulojë në fazën "Në pritje". |
| **Menaxheri menaxhon vetëm degët e autorizuara** | **Përfunduar** | CRUD i menusë, çmimet dhe disponueshmëria sipas degës, orari javor dhe kapaciteti i intervaleve, caktimi/heqja e stafit dhe raporte të plota me filtra sipas periudhës. |
| **Kuzhina sheh porositë, personalizimet, shënimet dhe afatet** | **Përfunduar** | Paneli i kuzhinës me filtra sipas stacioneve (`pizza`, `grill`, `oven`, `drinks`, `packaging`) dhe statusit, shënimet e klientit, shënimi i artikujve të përfunduar, konfirmimi i paketimit dhe përditësimi i audituar i afatit (ETA). |
| **Pika e marrjes regjistron pagesën dhe verifikon kodin** | **Përfunduar** | Paneli i marrjes shfaq porositë gati, regjistron pagesën me para në dorë ("E papaguar" → "E paguar"), verifikon kodin me skaner QR ose futje manuale, dhe përfundon porosinë në mënyrë atomike. |
| **Administratori mbikëqyr platformën** | **Përfunduar** | Paneli i administratorit lejon miratimin dhe pezullimin e restoranteve, menaxhimin e kategorive dhe caktimin e stafit në degë me audit log. |
| **Regjistrimi publik krijon vetëm klient** | **Përfunduar** | Endpoint-i i regjistrimit cakton vetëm rolin `customer`; roli i dërguar nga klienti injorohet plotësisht në backend. |
| **Izolimi i stafit ndërmjet restoranteve** | **Përfunduar** | Stafi i restorantit A nuk mund të lexojë apo ndryshojë porositë e restorantit B; çdo veprim kontrollohet me anëtarësinë në degë (`staff_memberships`). |
| **7 lloje biznesesh të PDF-së** | **Përfunduar** | Pizzeria, Fast Food, Restorant Tradicional, Kafe, Furrë Buke, Ëmbëltore dhe Ushqim i Shëndetshëm me kategori dhe produkte specifike. |
| **Restorant me 2 degë** | **Përfunduar** | `Casa Forno` përmban degët `Casa Forno Center` dhe `Casa Forno East`, të cilat menaxhohen veçmas me çmime dhe disponueshmëri të pavarura. |
| **30 produkte, 6 grupe opsionesh, stacione** | **Përfunduar** | 36 produkte demo dhe 6 grupe opsionesh me kufij min/max, çmime shtesë dhe stacione të ndara përgatitjeje. |
| **Alergjenë dhe shënime të klientit** | **Përfunduar** | Fusha `allergens` e deklaruar për produktet dhe fushë e dedikuar `customer_note` me gjatësi të kufizuar në shportë dhe në porosi. |
| **Shporta e një dege dhe konfirmim para ndërrimit** | **Përfunduar** | Shporta kufizohet në një degë të vetme; ndërrimi i degës shfaq dialogun e konfirmimit për zbrazjen e shportës. |
| **Çmimi i kontrolluar dhe rikonfirmimi 409** | **Përfunduar** | Serveri rivlerëson çmimet në blerje; çmimi i manipuluar refuzohet dhe ndryshimi i çmimit në meny kërkon rikonfirmim nga klienti. |
| **Porosi ASAP dhe me orar të planifikuar** | **Përfunduar** | Zgjedhje e marrjes së menjëhershme ose me interval kohor; vendi rezervohet në mënyrë atomike dhe lirohet në rast anulimi. |
| **Idempotency Key** | **Përfunduar** | Çelësi unik i idempotencës parandalon krijimin e porosive të dyfishta; riprovimi kthen të njëjtën porosi ekzistuese. |
| **Rregullat strikte të statusit** | **Përfunduar** | Rrjedha `Në pritje → E pranuar → Në përgatitje → Gati për marrje → E përfunduar`. Nuk lejohen kapërcime arbitrare; anulimi dhe refuzimi ruajnë arsyet përkatëse. |
| **Afati absolut (ETA) dhe numërimi mbrapsht** | **Përfunduar** | Ruhet `estimated_ready_at` dhe minutat llogariten nga klienti; në zero shfaqet mesazhi ekzakt *“Afati i parashikuar ka kaluar; presim përditësim”* pa e kaluar statusin në mënyrë artificiale. |
| **Kodi dhe QR i marrjes** | **Përfunduar** | Gjenerohet token i rastësishëm njëpërdorimësh pa të dhëna personale, i shfaqur si kod dhe si QR kod i skanueshëm. |
| **Raportet e menaxherit** | **Përfunduar** | Filtra sipas degës dhe periudhës, numri i porosive, të ardhurat e arkëtuara, produktet bestseller, koha mesatare nga fillimi deri në "Gati", porositë e vonuara dhe paraqitja e veçuar e porosive të anuluara/refuzuara. |
