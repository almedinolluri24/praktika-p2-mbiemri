# Foodora Laravel API

Backend-i Laravel ekspozon katalogun publik, autentikimin me sesion/CSRF, porositë e marrjes dhe endpoint-e të kufizuara për stafin/adminin. Klienti mund të lexojë historikun e vet dhe porositë përfshijnë ETA/historikun e statusit.

Nisja nga kjo dosje dhe hapat e konfigurimit gjenden te [README kryesor](../README.md). API-ja që ekziston, rolet, kufizimet dhe verifikimi janë dokumentuar te [raporti i auditimit](../docs/PROJECT-AUDIT.md) dhe [raporti i testeve](../docs/TEST-REPORT.md).

Komanda e testimit: `php artisan test`. Testet përdorin SQLite in-memory; MySQL nuk është provuar ende. Seeder-i demo lejohet vetëm në mjediset `local` dhe `testing`.
