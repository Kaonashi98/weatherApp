import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, switchMap, throwError } from 'rxjs';
import { AppLanguageCode } from './app-language';
import { GeocodingService } from './geocoding';
import { OpenMeteoClient } from './open-meteo-client';
import { WeatherNotFoundError, WeatherServiceError } from './weather-errors';
import {
  CitySuggestion,
  DailyForecast,
  DailyPeriodForecast,
  HourlyForecast,
  OpenMeteoPlace,
  WeatherViewModel,
} from './weather.models';
import {
  effectiveWeatherCode,
  isCivilDaylight,
  resolveWeatherTheme,
  weatherDescription,
  weatherIcon,
} from '../weather-scene';
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
  sunrise?: Array<string | null>;
  sunset?: Array<string | null>;
  moonrise?: Array<string | null>;
  moonset?: Array<string | null>;
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
  private readonly forecastUrl = 'https://api.open-meteo.com/v1/forecast';
  private language: AppLanguageCode = 'it';

  constructor(
    private readonly client: OpenMeteoClient,
    private readonly geocoding: GeocodingService,
  ) {}

  setLanguage(language: AppLanguageCode): void {
    this.language = language;
    this.geocoding.setLanguage(language);
  }

  searchCities(query: string): Observable<CitySuggestion[]> {
    return this.geocoding.search(query);
  }

  getWeatherForSuggestion(suggestion: CitySuggestion): Observable<WeatherViewModel> {
    return this.getWeatherForPlace({
      name: suggestion.name,
      country: suggestion.country,
      country_code: suggestion.countryCode,
      admin1: suggestion.admin1,
      admin2: suggestion.admin2,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
  }

  getWeather(city: string): Observable<WeatherViewModel> {
    const query = city.trim();
    if (query.split(',')[0].trim().length < 4) {
      return throwError(() => new WeatherNotFoundError());
    }
    return this.geocoding
      .findBest(query)
      .pipe(
        switchMap((place) =>
          place ? this.getWeatherForPlace(place) : throwError(() => new WeatherNotFoundError()),
        ),
      );
  }

  refreshLiveFields(weather: WeatherViewModel): WeatherViewModel {
    const localIso = this.getLocalIso(weather.timeZone);
    const isDaylight =
      weather.sunRise && weather.sunSet
        ? isCivilDaylight(localIso, weather.sunRise, weather.sunSet)
        : weather.isDaylight;
    return {
      ...weather,
      localDateTime: this.formatCurrentDateTime(weather.timeZone),
      isDaylight,
      iconUrl: weatherIcon(weather.weatherCode, isDaylight),
      theme: resolveWeatherTheme(
        weather.weatherCode,
        weather.cloudCover,
        isDaylight,
        localIso,
        weather.sunRise,
        weather.sunSet,
      ),
    };
  }

  private getWeatherForPlace(place: OpenMeteoPlace): Observable<WeatherViewModel> {
    const current =
      'temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,weather_code,is_day';
    const hourly =
      'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,is_day';
    const daily =
      'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,rain_sum,showers_sum,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset,moonrise,moonset';
    const params = new HttpParams()
      .set('latitude', place.latitude)
      .set('longitude', place.longitude)
      .set('current', current)
      .set('hourly', hourly)
      .set('daily', daily)
      .set('forecast_days', 8)
      .set('timezone', 'auto');
    return this.client.get<ForecastResponse>(this.forecastUrl, params).pipe(
      map((forecast) => {
        this.assertForecast(forecast);
        return this.toViewModel(place, forecast);
      }),
    );
  }

  private toViewModel(place: OpenMeteoPlace, forecast: ForecastResponse): WeatherViewModel {
    const today = this.getLocalIso(forecast.timezone).slice(0, 10);
    const dayIndex = Math.max(0, forecast.daily.time.indexOf(today));
    const sunRise = this.item(forecast.daily.sunrise, dayIndex);
    const sunSet = this.item(forecast.daily.sunset, dayIndex);
    const moonRise = this.item(forecast.daily.moonrise, dayIndex);
    const moonSet = this.item(forecast.daily.moonset, dayIndex);
    const cloudCover = this.number(forecast.current.cloud_cover);
    const weatherCode = effectiveWeatherCode(
      this.number(forecast.current.weather_code),
      cloudCover,
    );
    const localIso = this.getLocalIso(forecast.timezone);
    const isDaylight =
      sunRise && sunSet
        ? isCivilDaylight(localIso, sunRise, sunSet)
        : forecast.current.is_day === 1;
    const allHours = forecast.hourly.time.map((time, index) => this.toHour(forecast.hourly, index));
    const currentHour = forecast.current.time.slice(0, 13);
    const start = Math.max(
      0,
      allHours.findIndex((hour) => hour.time.slice(0, 13) >= currentHour),
    );
    const hourly = allHours.slice(start, start + 24);
    const daily = forecast.daily.time.slice(dayIndex + 1, dayIndex + 8).map((_, offset) => {
      const index = dayIndex + 1 + offset;
      const date = forecast.daily.time[index];
      const hours = allHours.filter((hour) => hour.time.startsWith(date));
      return this.toDay(forecast.daily, index, hours);
    });
    return {
      city: place.name,
      country: this.country(place),
      admin1: place.admin1,
      admin2: place.admin2,
      countryCode: place.country_code,
      locationLabel: this.placeLabel(place),
      latitude: place.latitude,
      longitude: place.longitude,
      temperature: Math.round(this.number(forecast.current.temperature_2m)),
      windSpeed: Math.round(this.number(forecast.current.wind_speed_10m)),
      humidity: Math.round(this.number(forecast.current.relative_humidity_2m)),
      cloudCover,
      description: weatherDescription(weatherCode, this.language),
      iconUrl: weatherIcon(weatherCode, isDaylight),
      theme: resolveWeatherTheme(weatherCode, cloudCover, isDaylight, localIso, sunRise, sunSet),
      weatherCode,
      timeZone: forecast.timezone,
      isDaylight,
      sunRise,
      sunSet,
      moonRise,
      moonSet,
      sunRiseLabel: this.eventTime(sunRise, today),
      sunSetLabel: this.eventTime(sunSet, today),
      moonRiseLabel: this.eventTime(moonRise, today),
      moonSetLabel: this.eventTime(moonSet, today),
      localDateTime: this.formatCurrentDateTime(forecast.timezone),
      updatedAtLabel: this.formatApiDateTime(forecast.current.time),
      updatedAt: Date.now(),
      hourly,
      daily,
    };
  }

  private toHour(data: HourlyResponse, index: number): HourlyForecast {
    const time = data.time[index];
    const code = effectiveWeatherCode(
      this.number(data.weather_code[index]),
      this.number(data.cloud_cover[index]),
    );
    return {
      time,
      timeLabel: time.slice(11, 16),
      dateLabel: this.formatDate(time.slice(0, 10), true),
      temperature: Math.round(this.number(data.temperature_2m[index])),
      apparentTemperature: Math.round(this.number(data.apparent_temperature[index])),
      humidity: Math.round(this.number(data.relative_humidity_2m[index])),
      precipitationProbability: Math.round(this.number(data.precipitation_probability[index])),
      precipitation: this.round1(data.precipitation[index]),
      windSpeed: Math.round(this.number(data.wind_speed_10m[index])),
      windGusts: Math.round(this.number(data.wind_gusts_10m[index])),
      weatherCode: code,
      description: weatherDescription(code, this.language),
      iconUrl: weatherIcon(code, data.is_day[index] === 1),
    };
  }

  private toDay(data: DailyResponse, index: number, hours: HourlyForecast[]): DailyForecast {
    const date = data.time[index];
    const code = this.number(data.weather_code[index]);
    return {
      date,
      dateLabel: this.formatDate(date, false),
      shortDateLabel: this.formatDate(date, true),
      weatherCode: code,
      description: weatherDescription(code, this.language),
      iconUrl: weatherIcon(code, true),
      temperatureMax: Math.round(this.number(data.temperature_2m_max[index])),
      temperatureMin: Math.round(this.number(data.temperature_2m_min[index])),
      apparentTemperatureMax: Math.round(this.number(data.apparent_temperature_max[index])),
      apparentTemperatureMin: Math.round(this.number(data.apparent_temperature_min[index])),
      precipitationProbability: Math.round(this.number(data.precipitation_probability_max[index])),
      precipitationSum: this.round1(data.precipitation_sum[index]),
      rainSum: this.round1(data.rain_sum[index]),
      showersSum: this.round1(data.showers_sum[index]),
      snowfallSum: this.round1(data.snowfall_sum[index]),
      windSpeedMax: Math.round(this.number(data.wind_speed_10m_max[index])),
      windGustsMax: Math.round(this.number(data.wind_gusts_10m_max[index])),
      uvIndexMax: this.round1(data.uv_index_max[index]),
      sunriseLabel: this.eventTime(this.item(data.sunrise, index), date),
      sunsetLabel: this.eventTime(this.item(data.sunset, index), date),
      moonriseLabel: this.eventTime(this.item(data.moonrise, index), date),
      moonsetLabel: this.eventTime(this.item(data.moonset, index), date),
      morning: this.period(hours, 9, this.language === 'it' ? 'Mattina' : 'Morning'),
      evening: this.period(hours, 18, this.language === 'it' ? 'Sera' : 'Evening'),
      hours,
    };
  }

  private period(
    hours: HourlyForecast[],
    target: number,
    label: string,
  ): DailyPeriodForecast | null {
    const hour = hours.find((item) => Number(item.time.slice(11, 13)) === target);
    return hour
      ? {
          label,
          temperature: hour.temperature,
          apparentTemperature: hour.apparentTemperature,
          humidity: hour.humidity,
          precipitationProbability: hour.precipitationProbability,
          windSpeed: hour.windSpeed,
          description: hour.description,
          iconUrl: hour.iconUrl,
        }
      : null;
  }

  private country(place: OpenMeteoPlace): string {
    return (
      place.country?.trim() ||
      place.country_code?.trim() ||
      (this.language === 'it' ? 'Nazione non disponibile' : 'Country unavailable')
    );
  }
  private placeLabel(place: OpenMeteoPlace): string {
    const country = this.country(place);
    const admin = place.admin1?.trim();
    return admin &&
      this.normalize(admin) !== this.normalize(place.name) &&
      this.normalize(admin) !== this.normalize(country)
      ? `${place.name}, ${admin}, ${country}`
      : `${place.name}, ${country}`;
  }
  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
  private number(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  private round1(value: unknown): number {
    return Math.round(this.number(value) * 10) / 10;
  }

  private item(values: Array<string | null> | undefined, index: number): string | null {
    const value = values?.[index];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private assertForecast(value: ForecastResponse): void {
    const requiredCurrentValues = value?.current
      ? [
          value.current.temperature_2m,
          value.current.relative_humidity_2m,
          value.current.cloud_cover,
          value.current.wind_speed_10m,
          value.current.weather_code,
          value.current.is_day,
        ]
      : [];
    const hourlySeries = value?.hourly
      ? [
          value.hourly.temperature_2m,
          value.hourly.apparent_temperature,
          value.hourly.relative_humidity_2m,
          value.hourly.precipitation_probability,
          value.hourly.precipitation,
          value.hourly.weather_code,
          value.hourly.cloud_cover,
          value.hourly.wind_speed_10m,
          value.hourly.wind_gusts_10m,
          value.hourly.is_day,
        ]
      : [];
    const dailySeries = value?.daily
      ? [
          value.daily.weather_code,
          value.daily.temperature_2m_max,
          value.daily.temperature_2m_min,
          value.daily.apparent_temperature_max,
          value.daily.apparent_temperature_min,
          value.daily.precipitation_probability_max,
          value.daily.precipitation_sum,
          value.daily.rain_sum,
          value.daily.showers_sum,
          value.daily.snowfall_sum,
          value.daily.wind_speed_10m_max,
          value.daily.wind_gusts_10m_max,
          value.daily.uv_index_max,
        ]
      : [];
    if (
      !value ||
      typeof value.timezone !== 'string' ||
      !value.current ||
      typeof value.current.time !== 'string' ||
      !Array.isArray(value.hourly?.time) ||
      !Array.isArray(value.daily?.time) ||
      value.hourly.time.length === 0 ||
      value.daily.time.length === 0 ||
      requiredCurrentValues.length !== 6 ||
      requiredCurrentValues.some((item) => !Number.isFinite(item)) ||
      hourlySeries.some(
        (series) => !Array.isArray(series) || series.length < value.hourly.time.length,
      ) ||
      dailySeries.some(
        (series) => !Array.isArray(series) || series.length < value.daily.time.length,
      )
    ) {
      throw new WeatherServiceError();
    }

    try {
      new Intl.DateTimeFormat('en', { timeZone: value.timezone }).format();
    } catch {
      throw new WeatherServiceError();
    }
  }

  private getLocalIso(timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZone,
    }).formatToParts(new Date());
    const value = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((item) => item.type === type)?.value ?? '00';
    return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:${value('second')}`;
  }
  private locale(): string {
    return this.language === 'it' ? 'it-IT' : 'en-GB';
  }
  private formatCurrentDateTime(timeZone: string): string {
    return new Intl.DateTimeFormat(this.locale(), {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZone,
    })
      .format(new Date())
      .replace(' alle ore ', ', ');
  }
  private formatDate(date: string, short: boolean): string {
    const value = new Date(`${date}T12:00:00`);
    return new Intl.DateTimeFormat(
      this.locale(),
      short
        ? { weekday: 'short', day: '2-digit' }
        : { weekday: 'long', day: 'numeric', month: 'long' },
    ).format(value);
  }
  private formatApiDateTime(value: string): string {
    const [date, time = ''] = value.split('T');
    return `${this.formatDate(date, false)}, ${time.slice(0, 5)}`;
  }
  private eventTime(value: string | null | undefined, referenceDate: string): string {
    if (!value) return this.language === 'it' ? 'Non disponibile' : 'Unavailable';
    const normalized = value.replace(/([+-]\d{2}:\d{2}|Z)$/, '');
    const [date, time = ''] = normalized.split('T');
    return date === referenceDate
      ? time.slice(0, 5)
      : `${this.formatDate(date, true)}, ${time.slice(0, 5)}`;
  }
}
