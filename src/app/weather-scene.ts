import { AppLanguageCode } from './services/app-language';
import { WeatherTheme } from './services/weather.models';

const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82];
const SNOW_CODES = [71, 73, 75, 77, 85, 86];
const STORM_CODES = [95, 96, 99];
const FOG_CODES = [45, 48];

export function effectiveWeatherCode(code: number, cloudCover: number): number {
  if (![0, 1, 2, 3].includes(code)) return code;
  return cloudCover <= 15 ? 0 : cloudCover <= 65 ? 2 : 3;
}

export function weatherDescription(code: number, language: AppLanguageCode): string {
  const italian = language === 'it';
  if (code === 0) return italian ? 'Sereno' : 'Clear';
  if ([1, 2].includes(code)) return italian ? 'Parzialmente nuvoloso' : 'Partly cloudy';
  if (code === 3) return italian ? 'Nuvoloso' : 'Overcast';
  if (FOG_CODES.includes(code)) return italian ? 'Nebbia' : 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return italian ? 'Pioviggine' : 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return italian ? 'Pioggia' : 'Rain';
  if (SNOW_CODES.includes(code)) return italian ? 'Neve' : 'Snow';
  if (STORM_CODES.includes(code)) return italian ? 'Temporale' : 'Thunderstorm';
  return italian ? 'Condizioni variabili' : 'Variable conditions';
}

export function weatherIcon(code: number, daylight: boolean): string {
  let icon = 113;
  if ([1, 2].includes(code)) icon = 116;
  else if (code === 3) icon = 122;
  else if (FOG_CODES.includes(code)) icon = 248;
  else if ([51, 53, 55, 56, 57].includes(code)) icon = 266;
  else if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) icon = 302;
  else if (SNOW_CODES.includes(code)) icon = 338;
  else if (STORM_CODES.includes(code)) icon = 389;
  return `/weather_icons/${daylight ? 'day' : 'night'}/${icon}.png`;
}

export function resolveWeatherTheme(
  code: number,
  cloudCover: number,
  daylight: boolean,
  localIso: string,
  sunrise: string | null,
  sunset: string | null,
): WeatherTheme {
  if (STORM_CODES.includes(code)) return 'stormy';
  if (SNOW_CODES.includes(code)) return 'snowy';
  if (RAIN_CODES.includes(code)) return 'rainy';
  if (FOG_CODES.includes(code)) return 'foggy';
  if ([1, 2].includes(code) || (cloudCover > 15 && cloudCover <= 65)) {
    return daylight ? 'partly-cloudy' : 'partly-cloudy-night';
  }
  if (code === 3 || cloudCover > 65) return daylight ? 'cloudy' : 'cloudy-night';
  if (
    sunrise &&
    localIso >= shiftCivilMinutes(sunrise, -30) &&
    localIso < shiftCivilMinutes(sunrise, 60)
  ) {
    return 'sunrise';
  }
  if (
    sunset &&
    localIso >= shiftCivilMinutes(sunset, -60) &&
    localIso < shiftCivilMinutes(sunset, 30)
  ) {
    return localIso >= cleanCivilIso(sunset) ? 'sunset-glow' : 'sunset';
  }
  return daylight ? (code === 0 ? 'sunny' : 'default') : 'night';
}

export function isCivilDaylight(localIso: string, sunrise: string, sunset: string): boolean {
  return localIso >= cleanCivilIso(sunrise) && localIso < cleanCivilIso(sunset);
}

export function cleanCivilIso(value: string): string {
  return value.replace(/([+-]\d{2}:\d{2}|Z)$/, '');
}

export function shiftCivilMinutes(iso: string, minutes: number): string {
  const normalized = cleanCivilIso(iso);
  const [date, time] = normalized.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes));
  const pad = (input: number) => input.toString().padStart(2, '0');
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:00`;
}
