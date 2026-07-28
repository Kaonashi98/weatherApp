# Guida operativa Play Console — WeatherApp

## 1. Crea l'app

- Nome app: `WeatherApp`
- Lingua predefinita: Italiano (`it-IT`)
- Tipo: App
- Gratuita o a pagamento: Gratuita
- Application ID del bundle: `com.kaonashi98.weatherapp`
- Versione iniziale: `1.0.0` (`versionCode 1`)

## 2. Presenza nello Store

- Categoria: Meteo
- Email assistenza: `weatherapp.help@outlook.com`
- Sito: `https://weather-app-blond-six-70.vercel.app/`
- Privacy policy: `https://weather-app-blond-six-70.vercel.app/privacy.html`
- Nome sviluppatore: Nicola Zingaro

Copia nome, descrizione breve e descrizione completa da `listing-it.md`.

Carica:

- `assets/play-icon-512x512.png`
- `assets/feature-graphic-1024x500.png`
- `assets/screenshots/phone-01-search.png`
- `assets/screenshots/phone-02-weather.png`

## 3. Contenuti dell'app

- Norme sulla privacy: inserire l'URL HTTPS indicato sopra.
- Accesso all'app: tutte le funzionalità sono disponibili senza accesso speciale.
- Annunci: No, l'app non contiene annunci.
- App governativa: No.
- Funzionalità finanziarie: Nessuna.
- Salute: Nessuna funzionalità sanitaria.
- Account: l'app non permette di creare account; la dichiarazione di eliminazione account non si applica.
- Pubblico: l'app è un servizio meteo generale e non è progettata specificamente per bambini. Selezionare le fasce effettivamente desiderate; proposta prudente: 13 anni e oltre.
- IARC: nessuna violenza, sessualità, linguaggio volgare, droghe, gioco d'azzardo, acquisti, contenuti generati dagli utenti o comunicazione tra utenti.

## 4. Data safety — bozza conservativa

Usare `data-safety-notes-it.md` durante la compilazione e controllare le definizioni mostrate dalla Console.

Comportamento dell'app:

- nessun account, analytics, tracking, pubblicità, acquisto o GPS;
- unico permesso Android: Internet;
- testo della città inviato a Open-Meteo;
- coordinate della località scelta inviate a Open-Meteo e MET Norway;
- IP e dati tecnici ricevuti dai due fornitori per erogare il servizio;
- dati trasmessi tramite HTTPS;
- nessuna cronologia conservata dall'app;
- icone meteo incorporate localmente, senza richieste a WeatherAPI durante l'uso.

Non selezionare automaticamente “nessun dato raccolto”. Valutare in modo conservativo le categorie “Località approssimativa”, “Attività nell'app / altre azioni” e “Identificatori del dispositivo o altri identificatori”, specificando finalità “Funzionalità dell'app”, dati necessari e trattamento da parte di fornitori di servizio. Le risposte finali devono restare coerenti con la privacy policy.

## 5. Play App Signing e release

- Accettare Play App Signing con la chiave generata da Google (opzione predefinita consigliata).
- Caricare `release/weatherapp-1.0.0+1-release.aab`.
- Incollare il contenuto di `release/release-notes-it.txt` nelle note di rilascio italiane.
- Dopo il caricamento, confrontare il certificato upload con `release/release-info.txt`.

## 6. Test

1. Eseguire prima un Internal test personale se la Console lo consente.
2. Creare un Closed test e aggiungere almeno 12 indirizzi Google dei tester.
3. Pubblicare la release nel track chiuso e inviare ai tester il link di adesione.
4. Fare in modo che almeno 12 tester restino aderenti ininterrottamente per 14 giorni e usino realmente l'app.
5. Raccogliere feedback e annotare eventuali problemi o correzioni.
6. Trascorsi i 14 giorni, richiedere l'accesso alla produzione dal Dashboard e rispondere alle domande sul test.

## 7. Prima della produzione

- Controllare Pre-launch report, App Bundle Explorer e Policy status.
- Installare la build distribuita da Google Play su almeno un telefono reale.
- Provare ricerca, rete assente, rotazione, font grandi, alba/tramonto e più condizioni meteo.
- Scegliere paesi e regioni di distribuzione.
- Promuovere in produzione solo quando non restano errori bloccanti.

## 8. Backup obbligatorio della firma

Non caricare mai su Git, email o servizi non cifrati:

- `android/keystore/weatherapp-upload.jks`
- `android/key.properties`

Copiare entrambi i file insieme in almeno due posizioni cifrate separate, ad esempio un archivio cifrato su unità esterna e un archivio cifrato cloud. Verificare che le copie siano leggibili prima di eliminare o modificare gli originali.