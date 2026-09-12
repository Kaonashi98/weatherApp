import {
  effectiveWeatherCode,
  isCivilDaylight,
  resolveWeatherTheme,
  shiftCivilMinutes,
  weatherDescription,
  weatherIcon,
} from './weather-scene';

describe('weather scene', () => {
  it('dà priorità alle condizioni forti rispetto ad alba e tramonto', () => {
    const common = ['2026-09-12T06:15:00', '2026-09-12T06:30:00', '2026-09-12T19:30:00'] as const;
    expect(resolveWeatherTheme(95, 10, true, ...common)).toBe('stormy');
    expect(resolveWeatherTheme(65, 10, true, ...common)).toBe('rainy');
    expect(resolveWeatherTheme(75, 10, true, ...common)).toBe('snowy');
    expect(resolveWeatherTheme(45, 10, true, ...common)).toBe('foggy');
  });

  it('gestisce alba, tramonto, post-tramonto e notte sui timestamp civili', () => {
    const sunrise = '2026-09-12T06:30:00';
    const sunset = '2026-09-12T19:30:00';
    expect(resolveWeatherTheme(0, 10, false, '2026-09-12T06:15:00', sunrise, sunset)).toBe(
      'sunrise',
    );
    expect(resolveWeatherTheme(0, 10, true, '2026-09-12T19:00:00', sunrise, sunset)).toBe('sunset');
    expect(resolveWeatherTheme(0, 10, false, '2026-09-12T19:40:00', sunrise, sunset)).toBe(
      'sunset-glow',
    );
    expect(resolveWeatherTheme(0, 10, false, '2026-09-12T20:01:00', sunrise, sunset)).toBe('night');
  });

  it('normalizza nuvolosità, descrizione, icona e confronti giorno/notte', () => {
    expect(effectiveWeatherCode(0, 40)).toBe(2);
    expect(weatherDescription(61, 'en')).toBe('Rain');
    expect(weatherIcon(61, false)).toBe('/weather_icons/night/302.png');
    expect(
      isCivilDaylight('2026-09-12T12:00:00', '2026-09-12T06:30+02:00', '2026-09-12T19:30+02:00'),
    ).toBe(true);
    expect(shiftCivilMinutes('2026-01-01T00:10:00', -30)).toBe('2025-12-31T23:40:00');
  });
});
