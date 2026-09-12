import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  WeatherConnectionError,
  WeatherNotFoundError,
  WeatherServiceError,
} from './weather-errors';
import { CitySuggestion } from './weather.models';
import { WeatherService } from './weather';

function forecastResponse() {
  const today = new Date();
  const days = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  });
  const times = days.flatMap((day) =>
    Array.from({ length: 24 }, (_, hour) => `${day}T${String(hour).padStart(2, '0')}:00`),
  );
  const hourlyNumbers = (value: number) => times.map(() => value);
  const dailyNumbers = (value: number) => days.map(() => value);
  return {
    timezone: 'Europe/Rome',
    current: {
      temperature_2m: 28,
      relative_humidity_2m: 48,
      cloud_cover: 10,
      wind_speed_10m: 7,
      weather_code: 0,
      is_day: 1,
      time: `${days[0]}T12:00`,
    },
    hourly: {
      time: times,
      temperature_2m: hourlyNumbers(24),
      apparent_temperature: hourlyNumbers(25),
      relative_humidity_2m: hourlyNumbers(55),
      precipitation_probability: hourlyNumbers(20),
      precipitation: hourlyNumbers(0.2),
      weather_code: hourlyNumbers(1),
      cloud_cover: hourlyNumbers(30),
      wind_speed_10m: hourlyNumbers(8),
      wind_gusts_10m: hourlyNumbers(14),
      is_day: hourlyNumbers(1),
    },
    daily: {
      time: days,
      weather_code: dailyNumbers(1),
      temperature_2m_max: dailyNumbers(29),
      temperature_2m_min: dailyNumbers(18),
      apparent_temperature_max: dailyNumbers(30),
      apparent_temperature_min: dailyNumbers(17),
      precipitation_probability_max: dailyNumbers(25),
      precipitation_sum: dailyNumbers(0.3),
      rain_sum: dailyNumbers(0.2),
      showers_sum: dailyNumbers(0.1),
      snowfall_sum: dailyNumbers(0),
      wind_speed_10m_max: dailyNumbers(16),
      wind_gusts_10m_max: dailyNumbers(27),
      uv_index_max: dailyNumbers(6.2),
      sunrise: days.map((day) => `${day}T06:30`),
      sunset: days.map((day) => `${day}T19:30`),
      moonrise: days.map((day) => `${day}T21:00`),
      moonset: days.map((day) => `${day}T08:00`),
    },
  };
}

describe('WeatherService', () => {
  let service: WeatherService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WeatherService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('viene creato correttamente', () => expect(service).toBeTruthy());

  it('distingue la connessione assente', async () => {
    const result = firstValueFrom(service.searchCities('Roma'));
    http
      .expectOne((request) => request.url.includes('geocoding-api.open-meteo.com'))
      .error(new ProgressEvent('error'));
    await expect(result).rejects.toBeInstanceOf(WeatherConnectionError);
  });

  it('distingue un servizio temporaneamente non disponibile', async () => {
    const result = firstValueFrom(service.searchCities('Roma'));
    http
      .expectOne((request) => request.url.includes('geocoding-api.open-meteo.com'))
      .flush({}, { status: 503, statusText: 'Service unavailable' });
    await expect(result).rejects.toBeInstanceOf(WeatherServiceError);
  });

  it('elimina duplicati tecnici ma conserva località omonime reali', async () => {
    const result = firstValueFrom(service.searchCities('Bisceglie'));
    http
      .expectOne((request) => request.url.includes('geocoding-api.open-meteo.com'))
      .flush({
        results: [
          {
            id: 1,
            name: 'Bisceglie',
            latitude: 41.24,
            longitude: 16.5,
            country: 'Italia',
            admin1: 'Puglia',
          },
          {
            id: 1,
            name: 'Bisceglie',
            latitude: 41.24,
            longitude: 16.5,
            country: 'Italia',
            admin1: 'Puglia',
          },
          {
            id: 2,
            name: 'Bisceglie',
            latitude: 40.87,
            longitude: 14.77,
            country: 'Italia',
            admin1: 'Campania',
          },
        ],
      });
    expect((await result).map((item) => item.label)).toEqual([
      'Bisceglie, Puglia, Italia',
      'Bisceglie, Campania, Italia',
    ]);
  });

  it('carica attuale, 24 ore, 7 giorni e astronomia con una sola richiesta meteo', async () => {
    const city: CitySuggestion = {
      id: 'roma',
      name: 'Roma',
      country: 'Italia',
      admin1: 'Lazio',
      latitude: 41.89,
      longitude: 12.51,
      label: 'Roma, Lazio, Italia',
    };
    const result = firstValueFrom(service.getWeatherForSuggestion(city));
    const request = http.expectOne((candidate) =>
      candidate.url.includes('api.open-meteo.com/v1/forecast'),
    );
    expect(request.request.params.get('hourly')).toContain('precipitation_probability');
    expect(request.request.params.get('daily')).toContain('moonrise');
    expect(request.request.params.get('forecast_days')).toBe('8');
    request.flush(forecastResponse());
    const weather = await result;
    expect(weather.locationLabel).toBe('Roma, Lazio, Italia');
    expect(weather.hourly).toHaveLength(24);
    expect(weather.daily).toHaveLength(7);
    expect(weather.daily[0].morning?.temperature).toBe(24);
    expect(weather.sunRiseLabel).toBe('06:30');
  });

  it('riapre una città recente completa scegliendo l’omonimo corretto', async () => {
    const result = firstValueFrom(service.getWeather('Bisceglie, Campania, Italia'));
    http
      .expectOne((request) => request.url.includes('geocoding-api.open-meteo.com'))
      .flush({
        results: [
          {
            name: 'Bisceglie',
            country: 'Italia',
            admin1: 'Puglia',
            latitude: 41.24,
            longitude: 16.5,
          },
          {
            name: 'Bisceglie',
            country: 'Italia',
            admin1: 'Campania',
            latitude: 40.87,
            longitude: 14.77,
          },
        ],
      });
    const request = http.expectOne(
      (candidate) =>
        candidate.url.includes('api.open-meteo.com/v1/forecast') &&
        candidate.params.get('latitude') === '40.87',
    );
    request.flush(forecastResponse());
    expect((await result).locationLabel).toBe('Bisceglie, Campania, Italia');
  });

  it('localizza descrizioni e geocodifica in inglese', async () => {
    service.setLanguage('en');
    const result = firstValueFrom(service.searchCities('Rome'));
    const request = http.expectOne((candidate) =>
      candidate.url.includes('geocoding-api.open-meteo.com'),
    );
    expect(request.request.params.get('language')).toBe('en');
    request.flush({ results: [] });
    expect(await result).toEqual([]);
  });

  it('segnala una località inesistente senza avviare il forecast', async () => {
    const result = firstValueFrom(service.getWeather('CittaInesistente'));
    http
      .expectOne((request) => request.url.includes('geocoding-api.open-meteo.com'))
      .flush({ results: [] });
    await expect(result).rejects.toBeInstanceOf(WeatherNotFoundError);
    http.expectNone((request) => request.url.includes('api.open-meteo.com/v1/forecast'));
  });

  it('mantiene il meteo disponibile se i campi astronomici mancano', async () => {
    const city: CitySuggestion = {
      id: 'roma',
      name: 'Roma',
      country: 'Italia',
      latitude: 41.89,
      longitude: 12.51,
      label: 'Roma, Italia',
    };
    const result = firstValueFrom(service.getWeatherForSuggestion(city));
    const response = forecastResponse();
    response.daily.sunrise = undefined as unknown as string[];
    response.daily.sunset = undefined as unknown as string[];
    response.daily.moonrise = undefined as unknown as string[];
    response.daily.moonset = undefined as unknown as string[];
    http
      .expectOne((request) => request.url.includes('api.open-meteo.com/v1/forecast'))
      .flush(response);

    const weather = await result;
    expect(weather.sunRiseLabel).toBe('Non disponibile');
    expect(weather.moonRiseLabel).toBe('Non disponibile');
    expect(weather.daily[0].sunriseLabel).toBe('Non disponibile');
    expect(weather.isDaylight).toBe(true);
  });

  it('rifiuta una risposta forecast strutturalmente incompleta', async () => {
    const city: CitySuggestion = {
      id: 'roma',
      name: 'Roma',
      country: 'Italia',
      latitude: 41.89,
      longitude: 12.51,
      label: 'Roma, Italia',
    };
    const result = firstValueFrom(service.getWeatherForSuggestion(city));
    http
      .expectOne((request) => request.url.includes('api.open-meteo.com/v1/forecast'))
      .flush({ timezone: 'Europe/Rome' });
    await expect(result).rejects.toBeInstanceOf(WeatherServiceError);
  });
});
