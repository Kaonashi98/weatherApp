import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, switchMap, throwError, timeout, TimeoutError } from 'rxjs';
import { AppLanguageCode } from './app-language';

export class WeatherConnectionError extends Error {
  constructor() { super('Connessione non disponibile.'); }
}

export class WeatherServiceError extends Error {
  constructor() { super('Servizio meteo non disponibile.'); }
}

export class WeatherNotFoundError extends Error {
  constructor() { super('Localita non trovata.'); }
}

export type WeatherTheme = 'default' | 'sunny' | 'partly-cloudy' | 'partly-cloudy-night' | 'cloudy' | 'cloudy-night' | 'rainy' | 'snowy' | 'stormy' | 'foggy' | 'sunrise' | 'sunset' | 'sunset-glow' | 'night';

export type CitySuggestion = {
  id: string;
  name: string;
  country: string;
  admin1?: string;
  admin2?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  label: string;
};

export type HourlyForecast = {
  time: string;
  timeLabel: string;
  dateLabel: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitationProbability: number;
  precipitation: number;
  windSpeed: number;
  windGusts: number;
  weatherCode: number;
  description: string;
  iconUrl: string;
};

export type DailyPeriodForecast = {
  label: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitationProbability: number;
  windSpeed: number;
  description: string;
  iconUrl: string;
};

export type DailyForecast = {
  date: string;
  dateLabel: string;
  shortDateLabel: string;
  weatherCode: number;
  description: string;
  iconUrl: string;
  temperatureMax: number;
  temperatureMin: number;
  apparentTemperatureMax: number;
  apparentTemperatureMin: number;
  precipitationProbability: number;
  precipitationSum: number;
  rainSum: number;
  showersSum: number;
  snowfallSum: number;
  windSpeedMax: number;
  windGustsMax: number;
  uvIndexMax: number;
  sunriseLabel: string;
  sunsetLabel: string;
  moonriseLabel: string;
  moonsetLabel: string;
  morning: DailyPeriodForecast | null;
  evening: DailyPeriodForecast | null;
  hours: HourlyForecast[];
};

export type WeatherViewModel = {
  city: string;
  country: string;
  admin1?: string;
  admin2?: string;
  countryCode?: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  temperature: number;
  windSpeed: number;
  humidity: number;
  cloudCover: number;
  description: string;
  iconUrl: string;
  theme: WeatherTheme;
  weatherCode: number;
  timeZone: string;
  isDaylight: boolean;
  sunRise: string | null;
  sunSet: string | null;
  moonRise: string | null;
  moonSet: string | null;
  sunRiseLabel: string;
  sunSetLabel: string;
  moonRiseLabel: string;
  moonSetLabel: string;
  localDateTime: string;
  updatedAtLabel: string;
  updatedAt: number;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
};

type Place = {
  id?: number;
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  latitude: number;
  longitude: number;
};

type GeocodingResponse = { results?: Place[] };
type HourlyResponse = {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  relative_humidity_2m: number[];
  precipitation_probability: number[];
  precipitation: number[];
  weather_code: number[];
  cloud_cover: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  is_day: number[];
};
type DailyResponse = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  precipitation_probability_max: number[];
  precipitation_sum: number[];
  rain_sum: number[];
  showers_sum: number[];
  snowfall_sum: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: number[];
  uv_index_max: number[];
  sunrise: string[];
  sunset: string[];
  moonrise: string[];
  moonset: string[];
};
type ForecastResponse = {
  timezone: string;
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    cloud_cover: number;
    wind_speed_10m: number;
    weather_code: number;
    is_day: number;
    time: string;
  };
  hourly: HourlyResponse;
  daily: DailyResponse;
};

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly requestTimeout = 12_000;
  private readonly geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';
  private readonly forecastUrl = 'https://api.open-meteo.com/v1/forecast';
  private language: AppLanguageCode = 'it';
  private readonly aliases: Record<string, string[]> = {
    seoul: ['seul'], seul: ['seoul'], beijing: ['pechino'], pechino: ['beijing'],
    'new york': ['new york city'], 'citta del messico': ['mexico city'], 'rio de janeiro': ['rio']
  };

  constructor(private readonly http: HttpClient) {}

  setLanguage(language: AppLanguageCode): void { this.language = language; }

  searchCities(query: string): Observable<CitySuggestion[]> {
    const name = this.searchName(query);
    if (name.length < 2) return of([]);
    const params = new HttpParams().set('name', name).set('count', 8).set('language', this.language).set('format', 'json');
    return this.getJson<GeocodingResponse>(this.geocodingUrl, params).pipe(map((data) => this.toSuggestions(data.results ?? [])));
  }

  getWeatherForSuggestion(suggestion: CitySuggestion): Observable<WeatherViewModel> {
    return this.getWeatherForPlace({
      name: suggestion.name, country: suggestion.country, country_code: suggestion.countryCode,
      admin1: suggestion.admin1, admin2: suggestion.admin2,
      latitude: suggestion.latitude, longitude: suggestion.longitude
    });
  }

  getWeather(city: string): Observable<WeatherViewModel> {
    const query = city.trim();
    const name = this.searchName(query);
    if (name.length < 4) return throwError(() => new Error('Nome citta troppo breve.'));
    const params = new HttpParams().set('name', name).set('count', 8).set('language', this.language).set('format', 'json');
    return this.getJson<GeocodingResponse>(this.geocodingUrl, params).pipe(switchMap((data) => {
      const place = this.findBestPlace(query, data.results ?? []);
      return place ? this.getWeatherForPlace(place) : throwError(() => new WeatherNotFoundError());
    }));
  }

  refreshLiveFields(weather: WeatherViewModel): WeatherViewModel {
    const localIso = this.getLocalIso(weather.timeZone);
    const isDaylight = weather.sunRise && weather.sunSet
      ? this.isDaylight(localIso, weather.sunRise, weather.sunSet)
      : weather.isDaylight;
    return {
      ...weather,
      localDateTime: this.formatCurrentDateTime(weather.timeZone), isDaylight,
      iconUrl: this.icon(weather.weatherCode, isDaylight),
      theme: this.theme(weather.weatherCode, weather.cloudCover, isDaylight, localIso, weather.sunRise, weather.sunSet)
    };
  }

  private getWeatherForPlace(place: Place): Observable<WeatherViewModel> {
    const current = 'temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,weather_code,is_day';
    const hourly = 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,is_day';
    const daily = 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,rain_sum,showers_sum,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset,moonrise,moonset';
    const params = new HttpParams().set('latitude', place.latitude).set('longitude', place.longitude)
      .set('current', current).set('hourly', hourly).set('daily', daily).set('forecast_days', 8).set('timezone', 'auto');
    return this.getJson<ForecastResponse>(this.forecastUrl, params).pipe(map((forecast) => this.toViewModel(place, forecast)));
  }

  private toViewModel(place: Place, forecast: ForecastResponse): WeatherViewModel {
    const today = this.getLocalIso(forecast.timezone).slice(0, 10);
    const dayIndex = Math.max(0, forecast.daily.time.indexOf(today));
    const sunRise = forecast.daily.sunrise?.[dayIndex] ?? null;
    const sunSet = forecast.daily.sunset?.[dayIndex] ?? null;
    const moonRise = forecast.daily.moonrise?.[dayIndex] ?? null;
    const moonSet = forecast.daily.moonset?.[dayIndex] ?? null;
    const cloudCover = this.number(forecast.current.cloud_cover);
    const weatherCode = this.effectiveCode(this.number(forecast.current.weather_code), cloudCover);
    const localIso = this.getLocalIso(forecast.timezone);
    const isDaylight = sunRise && sunSet ? this.isDaylight(localIso, sunRise, sunSet) : forecast.current.is_day === 1;
    const allHours = forecast.hourly.time.map((time, index) => this.toHour(forecast.hourly, index));
    const currentHour = forecast.current.time.slice(0, 13);
    const start = Math.max(0, allHours.findIndex((hour) => hour.time.slice(0, 13) >= currentHour));
    const hourly = allHours.slice(start, start + 24);
    const daily = forecast.daily.time.slice(dayIndex + 1, dayIndex + 8).map((_, offset) => {
      const index = dayIndex + 1 + offset;
      const date = forecast.daily.time[index];
      const hours = allHours.filter((hour) => hour.time.startsWith(date));
      return this.toDay(forecast.daily, index, hours);
    });
    return {
      city: place.name, country: this.country(place), admin1: place.admin1, admin2: place.admin2,
      countryCode: place.country_code, locationLabel: this.placeLabel(place),
      latitude: place.latitude, longitude: place.longitude,
      temperature: Math.round(this.number(forecast.current.temperature_2m)),
      windSpeed: Math.round(this.number(forecast.current.wind_speed_10m)),
      humidity: Math.round(this.number(forecast.current.relative_humidity_2m)), cloudCover,
      description: this.description(weatherCode), iconUrl: this.icon(weatherCode, isDaylight),
      theme: this.theme(weatherCode, cloudCover, isDaylight, localIso, sunRise, sunSet), weatherCode,
      timeZone: forecast.timezone, isDaylight, sunRise, sunSet, moonRise, moonSet,
      sunRiseLabel: this.eventTime(sunRise, today), sunSetLabel: this.eventTime(sunSet, today),
      moonRiseLabel: this.eventTime(moonRise, today), moonSetLabel: this.eventTime(moonSet, today),
      localDateTime: this.formatCurrentDateTime(forecast.timezone),
      updatedAtLabel: this.formatApiDateTime(forecast.current.time), updatedAt: Date.now(), hourly, daily
    };
  }

  private toHour(data: HourlyResponse, index: number): HourlyForecast {
    const time = data.time[index];
    const code = this.effectiveCode(this.number(data.weather_code[index]), this.number(data.cloud_cover[index]));
    return {
      time, timeLabel: time.slice(11, 16), dateLabel: this.formatDate(time.slice(0, 10), true),
      temperature: Math.round(this.number(data.temperature_2m[index])),
      apparentTemperature: Math.round(this.number(data.apparent_temperature[index])),
      humidity: Math.round(this.number(data.relative_humidity_2m[index])),
      precipitationProbability: Math.round(this.number(data.precipitation_probability[index])),
      precipitation: this.round1(data.precipitation[index]), windSpeed: Math.round(this.number(data.wind_speed_10m[index])),
      windGusts: Math.round(this.number(data.wind_gusts_10m[index])), weatherCode: code,
      description: this.description(code), iconUrl: this.icon(code, data.is_day[index] === 1)
    };
  }

  private toDay(data: DailyResponse, index: number, hours: HourlyForecast[]): DailyForecast {
    const date = data.time[index];
    const code = this.number(data.weather_code[index]);
    return {
      date, dateLabel: this.formatDate(date, false), shortDateLabel: this.formatDate(date, true), weatherCode: code,
      description: this.description(code), iconUrl: this.icon(code, true),
      temperatureMax: Math.round(this.number(data.temperature_2m_max[index])), temperatureMin: Math.round(this.number(data.temperature_2m_min[index])),
      apparentTemperatureMax: Math.round(this.number(data.apparent_temperature_max[index])), apparentTemperatureMin: Math.round(this.number(data.apparent_temperature_min[index])),
      precipitationProbability: Math.round(this.number(data.precipitation_probability_max[index])), precipitationSum: this.round1(data.precipitation_sum[index]),
      rainSum: this.round1(data.rain_sum[index]), showersSum: this.round1(data.showers_sum[index]), snowfallSum: this.round1(data.snowfall_sum[index]),
      windSpeedMax: Math.round(this.number(data.wind_speed_10m_max[index])), windGustsMax: Math.round(this.number(data.wind_gusts_10m_max[index])),
      uvIndexMax: this.round1(data.uv_index_max[index]), sunriseLabel: this.eventTime(data.sunrise[index], date), sunsetLabel: this.eventTime(data.sunset[index], date),
      moonriseLabel: this.eventTime(data.moonrise[index], date), moonsetLabel: this.eventTime(data.moonset[index], date),
      morning: this.period(hours, 9, this.language === 'it' ? 'Mattina' : 'Morning'),
      evening: this.period(hours, 18, this.language === 'it' ? 'Sera' : 'Evening'), hours
    };
  }

  private period(hours: HourlyForecast[], target: number, label: string): DailyPeriodForecast | null {
    const hour = hours.find((item) => Number(item.time.slice(11, 13)) === target);
    return hour ? { label, temperature: hour.temperature, apparentTemperature: hour.apparentTemperature, humidity: hour.humidity,
      precipitationProbability: hour.precipitationProbability, windSpeed: hour.windSpeed, description: hour.description, iconUrl: hour.iconUrl } : null;
  }

  private toSuggestions(places: Place[]): CitySuggestion[] {
    const seen = new Set<string>();
    return places.reduce<CitySuggestion[]>((result, place) => {
      if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude) || !place.country) return result;
      const key = place.id ? `geonames-${place.id}` : `${this.normalize(place.name)}-${place.latitude.toFixed(4)}-${place.longitude.toFixed(4)}`;
      if (seen.has(key)) return result;
      seen.add(key);
      result.push({ id: key, name: place.name, country: this.country(place), admin1: place.admin1?.trim(), admin2: place.admin2?.trim(),
        countryCode: place.country_code?.trim().toUpperCase(), latitude: place.latitude, longitude: place.longitude, label: this.placeLabel(place) });
      return result;
    }, []).slice(0, 5);
  }

  private findBestPlace(query: string, places: Place[]): Place | null {
    const exact = places.find((place) => this.normalize(this.placeLabel(place)) === this.normalize(query));
    if (exact) return exact;
    const name = this.normalize(this.searchName(query));
    const accepted = [name, ...(this.aliases[name] ?? [])];
    return places.find((place) => accepted.some((item) => this.normalize(place.name) === item || this.normalize(place.name).startsWith(`${item} `))) ?? null;
  }

  private country(place: Place): string { return place.country?.trim() || place.country_code?.trim() || (this.language === 'it' ? 'Nazione non disponibile' : 'Country unavailable'); }
  private placeLabel(place: Place): string {
    const country = this.country(place); const admin = place.admin1?.trim();
    return admin && this.normalize(admin) !== this.normalize(place.name) && this.normalize(admin) !== this.normalize(country)
      ? `${place.name}, ${admin}, ${country}` : `${place.name}, ${country}`;
  }
  private searchName(query: string): string { return query.split(',')[0].trim(); }
  private normalize(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  private number(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
  private round1(value: unknown): number { return Math.round(this.number(value) * 10) / 10; }

  private getJson<T>(url: string, params: HttpParams): Observable<T> {
    return this.http.get<T>(url, { params }).pipe(timeout(this.requestTimeout), catchError((error: unknown) => throwError(() => this.toWeatherError(error))));
  }
  private toWeatherError(error: unknown): Error {
    if (error instanceof WeatherConnectionError || error instanceof WeatherServiceError || error instanceof WeatherNotFoundError) return error;
    return error instanceof TimeoutError || (error instanceof HttpErrorResponse && error.status === 0) ? new WeatherConnectionError() : new WeatherServiceError();
  }

  private getLocalIso(timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(new Date());
    const value = (type: Intl.DateTimeFormatPartTypes): string => parts.find((item) => item.type === type)?.value ?? '00';
    return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:${value('second')}`;
  }
  private locale(): string { return this.language === 'it' ? 'it-IT' : 'en-GB'; }
  private formatCurrentDateTime(timeZone: string): string {
    return new Intl.DateTimeFormat(this.locale(), { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone }).format(new Date()).replace(' alle ore ', ', ');
  }
  private formatDate(date: string, short: boolean): string {
    const value = new Date(`${date}T12:00:00`);
    return new Intl.DateTimeFormat(this.locale(), short ? { weekday: 'short', day: '2-digit' } : { weekday: 'long', day: 'numeric', month: 'long' }).format(value);
  }
  private formatApiDateTime(value: string): string {
    const [date, time = ''] = value.split('T');
    return `${this.formatDate(date, false)}, ${time.slice(0, 5)}`;
  }
  private eventTime(value: string | null | undefined, referenceDate: string): string {
    if (!value) return this.language === 'it' ? 'Non disponibile' : 'Unavailable';
    const normalized = value.replace(/([+-]\d{2}:\d{2}|Z)$/, '');
    const [date, time = ''] = normalized.split('T');
    return date === referenceDate ? time.slice(0, 5) : `${this.formatDate(date, true)}, ${time.slice(0, 5)}`;
  }
  private isDaylight(localIso: string, sunrise: string, sunset: string): boolean {
    return localIso >= sunrise.replace(/([+-]\d{2}:\d{2}|Z)$/, '') && localIso < sunset.replace(/([+-]\d{2}:\d{2}|Z)$/, '');
  }

  private effectiveCode(code: number, cloud: number): number {
    if (![0, 1, 2, 3].includes(code)) return code;
    return cloud <= 15 ? 0 : cloud <= 65 ? 2 : 3;
  }
  private description(code: number): string {
    const it = this.language === 'it';
    if (code === 0) return it ? 'Sereno' : 'Clear';
    if ([1, 2].includes(code)) return it ? 'Parzialmente nuvoloso' : 'Partly cloudy';
    if (code === 3) return it ? 'Nuvoloso' : 'Overcast';
    if ([45, 48].includes(code)) return it ? 'Nebbia' : 'Fog';
    if ([51, 53, 55, 56, 57].includes(code)) return it ? 'Pioviggine' : 'Drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return it ? 'Pioggia' : 'Rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return it ? 'Neve' : 'Snow';
    if ([95, 96, 99].includes(code)) return it ? 'Temporale' : 'Thunderstorm';
    return it ? 'Condizioni variabili' : 'Variable conditions';
  }
  private icon(code: number, day: boolean): string {
    let icon = 113;
    if ([1, 2].includes(code)) icon = 116; else if (code === 3) icon = 122; else if ([45, 48].includes(code)) icon = 248;
    else if ([51, 53, 55, 56, 57].includes(code)) icon = 266; else if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) icon = 302;
    else if ([71, 73, 75, 77, 85, 86].includes(code)) icon = 338; else if ([95, 96, 99].includes(code)) icon = 389;
    return `/weather_icons/${day ? 'day' : 'night'}/${icon}.png`;
  }
  private theme(code: number, cloud: number, day: boolean, localIso: string, sunrise: string | null, sunset: string | null): WeatherTheme {
    if ([95, 96, 99].includes(code)) return 'stormy';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snowy';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rainy';
    if ([45, 48].includes(code)) return 'foggy';
    if ([1, 2].includes(code) || (cloud > 15 && cloud <= 65)) return day ? 'partly-cloudy' : 'partly-cloudy-night';
    if (code === 3 || cloud > 65) return day ? 'cloudy' : 'cloudy-night';
    if (sunrise && localIso >= this.addMinutes(sunrise, -30) && localIso < this.addMinutes(sunrise, 60)) return 'sunrise';
    if (sunset && localIso >= this.addMinutes(sunset, -60) && localIso < this.addMinutes(sunset, 30)) return localIso >= sunset ? 'sunset-glow' : 'sunset';
    return day ? (code === 0 ? 'sunny' : 'default') : 'night';
  }
  private addMinutes(iso: string, minutes: number): string {
    const normalized = iso.replace(/([+-]\d{2}:\d{2}|Z)$/, '');
    const [date, time] = normalized.split('T'); const [year, month, day] = date.split('-').map(Number); const [hour, minute] = time.split(':').map(Number);
    const value = new Date(year, month - 1, day, hour, minute + minutes); const pad = (input: number) => input.toString().padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:00`;
  }
}
