# Checklist di rilascio WeatherApp

## Identità e firma

- [x] Application ID definitivo: `com.kaonashi98.weatherapp`.
- [x] Nome sviluppatore: Nicola Zingaro.
- [x] Email pubblica: weatherapp.help@outlook.com.
- [x] Upload key RSA 4096 generata in un file `.jks` privato e ignorato da Git.
- [x] `android/key.properties` configurato con credenziali casuali robuste e ignorato da Git.
- [ ] Conservare keystore e password in almeno due backup cifrati.
- [ ] Abilitare Play App Signing.

## Privacy e licenze

- [x] Informativa completata con identità e contatti.
- [x] Pagina HTML pronta in `public/privacy.html`.
- [x] Pagina pubblicata e verificata via HTTPS: `https://weather-app-blond-six-70.vercel.app/privacy.html`.
- [ ] Inserire lo stesso URL nella Play Console.
- [x] Accesso a privacy, fonti e licenze reintrodotto sotto l'elenco delle città e verificato sull'emulatore.
- [ ] Compilare e verificare la dichiarazione Data safety.
- [x] Uso gratuito non commerciale e attribuzione Open-Meteo verificati il 28 luglio 2026; monitorare i limiti del servizio.
- [x] Diritti di logo e immagini atmosferiche confermati dal proprietario.

## Scheda Play Store

- [x] Icona Play 512 × 512 PNG, massimo 1 MB.
- [x] Feature graphic 1024 × 500 PNG/JPEG.
- [x] Due screenshot telefono 1080 x 2160 preparati e verificati (rapporto 2:1).
- [x] Descrizione breve e completa.
- [x] Categoria Meteo e contatti sviluppatore definiti.
- [x] Dichiarazione annunci prevista: No.
- [x] Prezzo: gratuita; nessuna pubblicità o acquisto in-app.
- [ ] Completare target audience e questionario IARC.
- [ ] Scegliere paesi e distribuzione.

## Verifica tecnica

- [x] `flutter analyze` — nessun problema.
- [x] `flutter test` — 10 test superati.
- [x] `flutter build appbundle --release` - AAB firmato generato.
- [x] Firma AAB e certificato upload verificati; certificato pubblico esportato.
- [x] Target API 36 e allineamento 16 KB verificati sugli artefatti release.
- [x] APK release x86_64 installato e verificato visivamente sull'emulatore.
- [ ] Installare una build generata da Play Internal Testing su almeno un telefono reale.
- [ ] Provare ricerca, errori di rete, rotazione e font grandi.

## Pubblicazione

- [ ] Caricare l'AAB in Internal testing.
- [ ] Controllare Pre-launch report e App Bundle Explorer.
- [ ] Correggere eventuali avvisi Play Console.
- [ ] Se l'account è personale e soggetto al requisito: test chiuso con almeno 12 tester per 14 giorni continuativi.
- [x] Note di rilascio italiane preparate per la versione 1.0.0.
- [ ] Promuovere in produzione solo dopo esito positivo dei controlli.
