# WeatherApp Flutter

Applicazione meteo Android realizzata in Flutter. Consente di cercare una localita, visualizzare le condizioni meteorologiche attuali e mostrare informazioni astronomiche locali con una UI responsive e animazioni coerenti con le condizioni meteo.

## Funzionalita

- Ricerca manuale con suggerimenti di localita.
- Selezione rapida delle citta piu comuni.
- Temperatura, umidita, vento, ora locale e dati di sole e luna.
- Temi e animazioni per sereno, nuvoloso, pioggia, neve, nebbia, temporale, alba e tramonto.
- Gestione esplicita di assenza di rete, servizio non disponibile e localita non trovata.
- Prevenzione delle risposte di rete obsolete: una ricerca precedente non puo sovrascrivere quella piu recente.
- Layout adattivo per telefono, tablet e desktop.

## Architettura

```text
lib/
  main.dart                    Avvio e tema Material
  models/weather_models.dart   Modelli immutabili della UI
  services/weather_service.dart Integrazione API e trasformazione dati
  screens/weather_screen.dart  Stato e interazioni della schermata
  widgets/weather_scene.dart   Sfondo e animazioni meteo
```

L'app usa Open-Meteo per geocoding e condizioni correnti, e MET Norway Sunrise API per gli eventi di sole e luna. Le icone meteo sono una famiglia grafica originale creata appositamente per WeatherApp e inclusa negli asset locali, quindi non richiedono servizi esterni durante l'uso. Se i dati astronomici non sono temporaneamente disponibili, le condizioni meteo principali vengono comunque mostrate.

## Avvio locale

```powershell
flutter pub get
flutter run
```

## Test

```powershell
flutter analyze
flutter test
```

I test coprono i casi di connessione assente, localita non trovata, indisponibilita del servizio e le interazioni principali della schermata iniziale.

## Note per la release

I materiali di lavoro per Google Play sono in `play_store/`. L'accesso a privacy, fonti e licenze è disponibile sotto l'elenco delle città, senza alterare l'interfaccia originale ripristinata.

L'application ID definitivo è `com.kaonashi98.weatherapp`. La upload key privata e `android/key.properties` sono configurati e ignorati da Git. La privacy policy è pubblicata all'indirizzo `https://weather-app-blond-six-70.vercel.app/privacy.html`.

L'App Bundle firmato pronto per il caricamento è in `play_store/release/weatherapp-1.0.0+1-release.aab`. Restano i backup cifrati dei segreti di firma e le dichiarazioni, i test e le impostazioni nella Play Console.