# WeatherApp

WeatherApp è una webapp meteo responsive realizzata con Angular. Permette di cercare una località, consultare condizioni attuali e previsioni e visualizza una scena atmosferica dinamica coerente con meteo, ora locale, alba, tramonto e notte.

Demo: [weather-app-blond-six-70.vercel.app](https://weather-app-blond-six-70.vercel.app/)

## Funzionalità

- ricerca con suggerimenti e supporto alle località omonime;
- condizioni attuali, prossime 24 ore e previsioni per 7 giorni;
- temperatura, umidità, vento, precipitazioni, UV e temperatura percepita;
- alba e tramonto di sole e luna, quando disponibili;
- recenti, preferiti e lingua salvati soltanto nel browser;
- messaggi distinti per località inesistente, assenza di rete e servizio indisponibile;
- timeout delle richieste, cancellazione delle ricerche superate e fallback per dati astronomici mancanti;
- scena meteo animata con supporto a `prefers-reduced-motion`;
- interfaccia italiana e inglese, responsive da smartphone a desktop.

Le condizioni forti (temporale, neve, pioggia e nebbia) hanno priorità visiva sui temi solari. Il sole segue l'avanzamento fra alba e tramonto; dopo il tramonto rimane una breve fase di cielo caldo prima della notte.

## Stack

- Angular 22 e TypeScript in modalità strict;
- Angular Forms e HttpClient;
- RxJS;
- Vitest tramite il test runner Angular;
- CSS responsive e Canvas 2D per gli effetti atmosferici;
- Vercel per la demo pubblica.

## API e dati

- **Open-Meteo Geocoding API**: ricerca delle località;
- **Open-Meteo Forecast API**: condizioni, forecast e campi astronomici giornalieri;
- **GeoNames**: dataset a monte del servizio di geocodifica Open-Meteo; la webapp non chiama direttamente GeoNames.

Il codice corrente non effettua richieste dirette a MET Norway. Non sono richieste API key o variabili d'ambiente.

## Architettura

`AppComponent` orchestra stato e interazioni della schermata senza conoscere i dettagli HTTP dei provider. La pipeline dati è divisa in poche unità:

```text
src/app/
  app.ts                         orchestrazione UI e lifecycle
  app.html                       schermata principale e dialog
  app.css                        layout, temi e responsive
  weather-scene.ts               logica pura per temi, codici e orari solari
  weather-scene-effects.ts       rendering Canvas degli effetti atmosferici
  services/
    weather.ts                   facciata forecast e mapping del view model
    geocoding.ts                 ricerca, deduplicazione e scelta località
    open-meteo-client.ts         timeout ed error mapping HTTP condivisi
    weather.models.ts            contratti di dominio e view model
    weather-errors.ts            errori applicativi tipizzati
    recent-cities.ts             cronologia locale compatibile
    favorite-cities.ts           preferiti locali
    app-language.ts              preferenza lingua

public/
  condizioni_atmosferiche/       asset della scena
  weather_icons/                 icone meteo giorno/notte
  images/                        logo
  privacy.html                   informativa privacy bilingue
```

Non viene usato uno state manager esterno: per le dimensioni dell'app, stato locale e servizi Angular mantengono il flusso più semplice e leggibile.

## Avvio locale

Requisiti: Node.js 22 e npm 11.

```bash
npm ci
npm start
```

Apri `http://localhost:4200`.

## Qualità e test

```bash
npm run build
npm test
npm run test:watch
npm run format:check
npm audit
npm ls
```

I test coprono servizi di persistenza, lingua, geocodifica, località omonime, errori HTTP, payload incompleti, fallback astronomico, protezione dalle risposte obsolete e priorità della scena meteo.

La GitHub Action in `.github/workflows/ci.yml` esegue su push a `main` e pull request: installazione riproducibile, controllo Prettier, build di produzione e test non interattivi.

## Deploy

La demo è ospitata su Vercel. Il repository non contiene script che pubblicano automaticamente dal computer locale; la configurazione del progetto Vercel collegato gestisce il deploy dopo gli aggiornamenti del branch configurato.

## Limitazioni

- disponibilità e precisione dipendono dai servizi Open-Meteo;
- alcuni eventi lunari non sono disponibili per tutte le date o località;
- recenti, preferiti e lingua non vengono sincronizzati tra dispositivi;
- la webapp non usa la posizione GPS e richiede una ricerca testuale.

Le informazioni sul trattamento dei dati sono disponibili nell'[informativa privacy](https://weather-app-blond-six-70.vercel.app/privacy.html).
