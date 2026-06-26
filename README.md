# WeatherApp

WeatherApp è un progetto che ho costruito con Angular per mettere insieme una piccola applicazione web utile e abbastanza completa da mostrare il mio modo di lavorare. L’idea era semplice: permettere di cercare una località, vedere il meteo attuale e avere un’interfaccia chiara anche su mobile.

## Cosa ho voluto realizzare

- Ricerca di una località con suggerimenti mentre si scrive.
- Dati meteo aggiornati, tra cui temperatura, umidità, vento e condizioni generali.
- Informazioni su ora locale, alba e tramonto del sole e della luna, quando disponibili.
- Un’interfaccia responsive, pensata per essere usata bene sia desktop sia telefono.
- Piccoli dettagli come caricamento, messaggi di errore e feedback visivi per rendere l’esperienza più naturale.

## Tecnologie usate

- Angular 21
- TypeScript
- Angular Forms
- HttpClient
- RxJS
- CSS responsive
- API Open-Meteo
- API MET Norway

## Come farlo partire in locale

Se vuoi provarlo sul tuo computer, basta clonare il repository, installare le dipendenze e avviare l’app:

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
npm run build
npm test
```

## Perché mi piace questo progetto

Mi è sembrato un buon modo per mettere in pratica più aspetti del lavoro front-end: componenti Angular, chiamate HTTP, gestione della UI, validazione degli input e integrazione con API esterne. È anche il tipo di progetto che posso mostrare con tranquillità perché fa vedere il mio approccio pratico e ordinato.

## Note

I dati mostrati dipendono da servizi esterni e possono cambiare leggermente rispetto alla realtà, soprattutto per località più piccole o condizioni variabili.
