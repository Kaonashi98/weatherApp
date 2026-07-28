# Note per la sezione Data safety

Queste note sono una base operativa per la compilazione in Play Console.

## Comportamento verificato nel codice

- Nessun account.
- App totalmente gratuita.
- Nessuna pubblicità.
- Nessun acquisto in-app.
- Nessun SDK analytics o tracking.
- Nessun accesso GPS o permesso di localizzazione Android.
- Solo permesso INTERNET.
- Il nome della località digitata viene inviato a Open-Meteo.
- Coordinate, IP e dati tecnici di rete vengono ricevuti da Open-Meteo e MET Norway.
- Le icone WeatherAPI.com sono incorporate nell'app e non generano richieste al relativo servizio durante l'uso.
- Nessuna cronologia delle ricerche salvata permanentemente dall'app.
- Dati cifrati in transito tramite HTTPS.

## Dichiarazione da valutare in Play Console

Non selezionare automaticamente “nessun dato raccolto”. Verificare le definizioni correnti di Google Play per:

- Località approssimativa: coordinate della città scelta, non GPS del dispositivo;
- Attività nell'app / altre azioni: testo della ricerca inviato al geocoder;
- Identificatori del dispositivo o altri identificatori: indirizzo IP ricevuto dai fornitori;
- trattamento effimero rispetto ai log conservati dai fornitori.

Finalità: funzionalità dell'app e prevenzione degli abusi del servizio. Nessun uso per pubblicità, marketing o profilazione.

La dichiarazione finale deve essere coerente con l'informativa privacy pubblicata e con i termini aggiornati dei fornitori.