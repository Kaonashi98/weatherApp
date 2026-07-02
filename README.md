# WeatherApp

WeatherApp è una webapp meteo realizzata con Angular. L'ho costruita per cercare una località, mostrare il meteo attuale e rendere l'esperienza visiva più naturale attraverso una scena atmosferica dinamica che cambia in base a ora locale, condizioni meteo, alba, tramonto e notte.

Demo online: [weather-app-blond-six-70.vercel.app](https://weather-app-blond-six-70.vercel.app/)

## Obiettivo del progetto

L'obiettivo era creare una piccola applicazione front-end completa, curata e presentabile, non solo una semplice chiamata API. Ho voluto unire ricerca, dati meteo reali, informazioni astronomiche e una UI responsive con dettagli visivi capaci di comunicare subito il momento della giornata e le condizioni atmosferiche.

## Funzionalità principali

- Ricerca meteo per città o località.
- Suggerimenti automatici durante la digitazione.
- Selezione rapida di città principali.
- Temperatura attuale, umidità, vento e descrizione delle condizioni.
- Ora locale della città cercata.
- Orari di alba e tramonto del sole.
- Orari di alba e tramonto della luna, quando disponibili.
- Icone meteo giorno/notte coerenti con la condizione attuale.
- Messaggi di errore per ricerche non valide o località non trovate.
- Stato di caricamento con skeleton UI.
- Layout responsive per desktop, tablet e smartphone.
- Pannello mobile dedicato per consultare il meteo senza perdere la ricerca.

## Scena meteo dinamica

La parte visiva della webapp cambia automaticamente in base ai dati meteo e all'orario locale della città selezionata.

Sono gestiti questi temi:

- cielo sereno;
- parzialmente nuvoloso;
- nuvoloso;
- pioggia;
- neve;
- temporale;
- nebbia;
- notte serena;
- notte parzialmente nuvolosa;
- notte nuvolosa;
- alba;
- tramonto;
- cielo post-tramonto senza sole.

La scena usa immagini atmosferiche dedicate, per esempio cielo sereno, cielo stellato, nuvole, pioggia, neve, nebbia, temporale, alba e tramonto. Sole e luna vengono mostrati come elementi separati, così possono cambiare posizione o sparire quando serve.

## Alba, sole e tramonto

Ho reso la gestione del sole più realistica rispetto a una posizione fissa.

- L'alba viene mostrata da 30 minuti prima dell'orario di alba fino a 60 minuti dopo.
- Durante l'alba il sole parte basso e sale gradualmente.
- Durante il giorno il sole cambia altezza in base all'avanzamento tra alba e tramonto.
- Nel tramonto il sole scende progressivamente verso l'orizzonte.
- Dopo l'orario esatto del tramonto il sole sparisce, ma il cielo caldo del tramonto resta ancora per 30 minuti.
- Dopo questa fase la scena passa alla notte o alla condizione meteo reale.

Le condizioni più forti, come pioggia, neve, nebbia e temporale, hanno priorità sui temi di alba e tramonto, perché in quei casi il meteo reale deve prevalere sulla scena luminosa.

## API utilizzate

- [Open-Meteo Geocoding API](https://open-meteo.com/) per cercare le località.
- [Open-Meteo Forecast API](https://open-meteo.com/) per temperatura, umidità, vento, copertura nuvolosa e codice meteo.
- [MET Norway Sunrise API](https://api.met.no/) per alba, tramonto, luna e dati astronomici.
- Icone meteo caricate da CDN WeatherAPI.

Non sono necessarie chiavi API per avviare il progetto in locale.

## Tecnologie usate

- Angular 22
- TypeScript
- Angular Forms
- HttpClient
- RxJS
- CSS responsive
- Vercel per il deploy
- npm

## Struttura del progetto

```text
src/
  app/
    app.ts                 Componente principale e gestione UI
    app.html               Template dell'applicazione
    app.css                Stili, responsive layout e scena meteo
    app.config.ts          Configurazione Angular
    services/
      weather.ts           Logica API, dati meteo, temi e astronomia
      weather.spec.ts      Test del servizio meteo
  main.ts                  Bootstrap dell'app
  index.html               Documento HTML principale

public/
  images/                  Logo dell'app
  condizioni_atmosferiche/ Asset visivi per cielo, sole, luna e meteo
```

## Come avviare il progetto in locale

Clona il repository, installa le dipendenze e avvia il server di sviluppo:

```bash
npm install
npm start
```

Poi apri:

```text
http://localhost:4200
```

## Script disponibili

```bash
npm start
```

Avvia l'app in modalità sviluppo.

```bash
npm run build
```

Crea la build di produzione.

```bash
npm test
```

Esegue i test configurati nel progetto.

## Deploy

Il progetto è deployato su Vercel. Dopo un commit e un push sul branch collegato al progetto, Vercel avvia automaticamente una nuova build e aggiorna il sito online quando il deploy termina correttamente.

## Note

I dati meteo e astronomici dipendono da servizi esterni. Per questo motivo alcune informazioni possono variare leggermente in base alla località, alla copertura del servizio o all'aggiornamento delle API.

Questo progetto è pensato per mostrare competenze front-end pratiche: integrazione API, gestione dello stato, UI responsive, attenzione al dettaglio visivo, logica temporale e cura dell'esperienza utente.
