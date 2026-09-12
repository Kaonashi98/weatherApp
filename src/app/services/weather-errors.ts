export class WeatherConnectionError extends Error {
  constructor() {
    super('Connessione non disponibile.');
  }
}

export class WeatherServiceError extends Error {
  constructor() {
    super('Servizio meteo non disponibile.');
  }
}

export class WeatherNotFoundError extends Error {
  constructor() {
    super('Localita non trovata.');
  }
}
