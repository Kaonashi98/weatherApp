import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  CitySuggestion,
  WeatherConnectionError,
  WeatherService,
  WeatherServiceError,
  WeatherTheme
} from './weather';

describe('WeatherService', () => {
  let service: WeatherService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(WeatherService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('viene creato correttamente', () => {
    expect(service).toBeTruthy();
  });

  it('dà priorità alle nuvole durante alba e tramonto', () => {
    const getTheme = (
      code: number,
      cloudCover: number,
      isDaylight: boolean,
      localIso: string
    ): WeatherTheme =>
      (
        service as unknown as {
          getWeatherTheme(
            code: number,
            cloudCover: number,
            isDaylight: boolean,
            localIso: string,
            sunrise: string,
            sunset: string
          ): WeatherTheme;
        }
      ).getWeatherTheme(
        code,
        cloudCover,
        isDaylight,
        localIso,
        '2026-07-28T06:00:00+00:00',
        '2026-07-28T20:00:00+00:00'
      );

    expect(getTheme(2, 45, false, '2026-07-28T05:45:00')).toBe('partly-cloudy-night');
    expect(getTheme(3, 90, true, '2026-07-28T06:15:00')).toBe('cloudy');
    expect(getTheme(2, 45, true, '2026-07-28T19:30:00')).toBe('partly-cloudy');
    expect(getTheme(3, 90, false, '2026-07-28T20:10:00')).toBe('cloudy-night');
    expect(getTheme(61, 100, true, '2026-07-28T19:30:00')).toBe('rainy');
    expect(getTheme(0, 5, false, '2026-07-28T05:45:00')).toBe('sunrise');
  });

  it('distingue la connessione assente', async () => {
    const result = firstValueFrom(service.searchCities('Roma'));
    http.expectOne((request) => request.url.includes('geocoding-api.open-meteo.com')).error(
      new ProgressEvent('error')
    );

    await expect(result).rejects.toBeInstanceOf(WeatherConnectionError);
  });

  it('distingue un servizio temporaneamente non disponibile', async () => {
    const result = firstValueFrom(service.searchCities('Roma'));
    http.expectOne((request) => request.url.includes('geocoding-api.open-meteo.com')).flush(
      {},
      { status: 503, statusText: 'Service unavailable' }
    );

    await expect(result).rejects.toBeInstanceOf(WeatherServiceError);
  });

  it('elimina duplicati tecnici ma conserva localita omonime reali', async () => {
    const result = firstValueFrom(service.searchCities('Bisceglie'));
    http.expectOne((request) => request.url.includes('geocoding-api.open-meteo.com')).flush({
      results: [
        {
          id: 3182007,
          name: 'Bisceglie',
          latitude: 41.24264,
          longitude: 16.50104,
          country_code: 'IT',
          country: 'Italia',
          admin1: 'Puglia'
        },
        {
          id: 3182007,
          name: 'Bisceglie',
          latitude: 41.24264,
          longitude: 16.50104,
          country_code: 'IT',
          country: 'Italia',
          admin1: 'Puglia'
        },
        {
          id: 8964599,
          name: 'Bisceglie',
          latitude: 40.87613,
          longitude: 14.77798,
          country_code: 'IT',
          country: 'Italia',
          admin1: 'Campania'
        }
      ]
    });

    const suggestions = await result;
    expect(suggestions.map((suggestion) => suggestion.label)).toEqual([
      'Bisceglie, Puglia, Italia',
      'Bisceglie, Campania, Italia'
    ]);
  });

  it('mostra il meteo principale se il servizio astronomico non risponde', async () => {
    const suggestion: CitySuggestion = {
      id: 'roma',
      name: 'Roma',
      country: 'Italia',
      admin1: 'Lazio',
      latitude: 41.89193,
      longitude: 12.51133,
      label: 'Roma, Lazio, Italia'
    };
    const result = firstValueFrom(service.getWeatherForSuggestion(suggestion));

    http.expectOne((request) => request.url.includes('api.open-meteo.com/v1/forecast')).flush({
      timezone: 'Europe/Rome',
      current: {
        temperature_2m: 28,
        relative_humidity_2m: 48,
        cloud_cover: 10,
        wind_speed_10m: 7,
        weather_code: 0,
        is_day: 1,
        time: '2026-08-18T12:00'
      }
    });
    const astronomyRequests = http.match((request) => request.url.includes('api.met.no/weatherapi/sunrise'));
    expect(astronomyRequests).toHaveLength(4);
    astronomyRequests[0].flush({}, { status: 503, statusText: 'Service unavailable' });

    const weather = await result;
    expect(weather.locationLabel).toBe('Roma, Lazio, Italia');
    expect(weather.sunRiseLabel).toBe('Non disponibile');
    expect(weather.iconUrl).toContain('/day/113.png');
    expect(service.refreshLiveFields(weather).iconUrl).toContain('/day/113.png');
  });

  it('riapre una citta recente completa senza confonderla con un omonimo', async () => {
    const result = firstValueFrom(service.getWeather('Bisceglie, Campania, Italia'));
    http.expectOne((request) => request.url.includes('geocoding-api.open-meteo.com')).flush({
      results: [
        { name: 'Bisceglie', country: 'Italia', admin1: 'Puglia', latitude: 41.24264, longitude: 16.50104 },
        { name: 'Bisceglie', country: 'Italia', admin1: 'Campania', latitude: 40.87613, longitude: 14.77798 }
      ]
    });
    http.expectOne((request) =>
      request.url.includes('api.open-meteo.com/v1/forecast') && request.params.get('latitude') === '40.87613'
    ).flush({
      timezone: 'Europe/Rome',
      current: {
        temperature_2m: 24,
        relative_humidity_2m: 60,
        cloud_cover: 20,
        wind_speed_10m: 8,
        weather_code: 1,
        is_day: 1,
        time: '2026-08-18T12:00'
      }
    });
    for (const request of http.match((candidate) => candidate.url.includes('api.met.no/weatherapi/sunrise'))) {
      request.flush({ properties: {} });
    }

    expect((await result).locationLabel).toBe('Bisceglie, Campania, Italia');
  });
});
