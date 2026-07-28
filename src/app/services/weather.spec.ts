import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WeatherService, WeatherTheme } from './weather';

describe('WeatherService', () => {
  let service: WeatherService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(WeatherService);
  });

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
});
