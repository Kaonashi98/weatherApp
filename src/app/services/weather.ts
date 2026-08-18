import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { catchError, forkJoin, map, Observable, of, switchMap, tap, throwError, timeout, TimeoutError } from 'rxjs';

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

export type WeatherTheme = 'default' | 'sunny' | 'partly-cloudy' | 'partly-cloudy-night' | 'cloudy' | 'cloudy-night' | 'rainy' | 'snowy' | 'stormy' | 'foggy' | 'sunrise' | 'sunset' | 'sunset-glow' | 'night';

export type WeatherViewModel = {
  city: string;
  country: string;
  locationLabel: string;
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
};

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

type GeocodingResponse = {
  results?: Place[];
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
};

type AstronomyEvent = {
  time?: string;
} | null;

type AstronomyResponse = {
  properties?: Record<string, AstronomyEvent | string | number | null>;
};

type AstronomyData = {
  sunRise: string | null;
  sunSet: string | null;
  moonRise: string | null;
  moonSet: string | null;
};

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private readonly requestTimeout = 12_000;
  private readonly geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';
  private readonly forecastUrl = 'https://api.open-meteo.com/v1/forecast';
  private readonly astronomyUrl = 'https://api.met.no/weatherapi/sunrise/3.0';
  private readonly cityAliases: Record<string, string[]> = {
    seoul: ['seul'],
    seul: ['seoul'],
    beijing: ['pechino'],
    pechino: ['beijing'],
    'new york': ['new york city'],
    'citta del messico': ['mexico city'],
    'rio de janeiro': ['rio']
  };

  private readonly countryNamesByCode: Record<string, string> = {
    AR: 'Argentina',
    AT: 'Austria',
    BE: 'Belgio',
    BR: 'Brasile',
    CA: 'Canada',
    CH: 'Svizzera',
    CN: 'Cina',
    CZ: 'Repubblica Ceca',
    DE: 'Germania',
    DK: 'Danimarca',
    ES: 'Spagna',
    FI: 'Finlandia',
    FR: 'Francia',
    GB: 'Regno Unito',
    GR: 'Grecia',
    HK: 'Cina',
    IE: 'Irlanda',
    IT: 'Italia',
    JP: 'Giappone',
    KR: 'Corea del Sud',
    MX: 'Messico',
    NL: 'Paesi Bassi',
    NO: 'Norvegia',
    PL: 'Polonia',
    PT: 'Portogallo',
    SE: 'Svezia',
    SG: 'Singapore',
    TH: 'Thailandia',
    US: 'Stati Uniti'
  };

  private readonly months = [
    'gennaio',
    'febbraio',
    'marzo',
    'aprile',
    'maggio',
    'giugno',
    'luglio',
    'agosto',
    'settembre',
    'ottobre',
    'novembre',
    'dicembre'
  ];
  private readonly astronomyCache = new Map<string, AstronomyData>();

  constructor(private readonly http: HttpClient) {}

  searchCities(query: string): Observable<CitySuggestion[]> {
    const searchName = this.getSearchName(query);

    if (searchName.length < 2) return of([]);

    const params = new HttpParams()
      .set('name', searchName)
      .set('count', 8)
      .set('language', 'it')
      .set('format', 'json');

    return this.getJson<GeocodingResponse>(this.geocodingUrl, params).pipe(
      map((geocoding) => this.toCitySuggestions(geocoding.results ?? []))
    );
  }

  getWeatherForSuggestion(suggestion: CitySuggestion): Observable<WeatherViewModel> {
    return this.getWeatherForPlace({
      name: suggestion.name,
      country: suggestion.country,
      country_code: suggestion.countryCode,
      admin1: suggestion.admin1,
      admin2: suggestion.admin2,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude
    });
  }

  getWeather(city: string): Observable<WeatherViewModel> {
    const query = city.trim();
    const searchName = this.getSearchName(query);

    if (searchName.length < 4) {
      return throwError(() => new Error('Nome citta troppo breve.'));
    }

    const geocodingParams = new HttpParams()
      .set('name', searchName)
      .set('count', 8)
      .set('language', 'it')
      .set('format', 'json');

    return this.getJson<GeocodingResponse>(this.geocodingUrl, geocodingParams).pipe(
      switchMap((geocoding) => {
        const place = this.findBestPlace(query, geocoding.results ?? []);

        if (!place) {
          return throwError(() => new WeatherNotFoundError());
        }

        return this.getWeatherForPlace(place);
      })
    );
  }

  refreshLiveFields(weather: WeatherViewModel): WeatherViewModel {
    const localIso = this.getLocalIso(weather.timeZone);
    const isDaylight = weather.sunRise && weather.sunSet
      ? this.isDaylight(localIso, weather.sunRise, weather.sunSet)
      : weather.isDaylight;

    return {
      ...weather,
      localDateTime: this.formatCurrentDateTime(weather.timeZone),
      isDaylight,
      iconUrl: this.getWeatherIconUrl(weather.weatherCode, isDaylight),
      theme: this.getWeatherTheme(weather.weatherCode, weather.cloudCover, isDaylight, localIso, weather.sunRise, weather.sunSet)
    };
  }

  private getWeatherForPlace(place: Place): Observable<WeatherViewModel> {
    const forecastParams = new HttpParams()
      .set('latitude', place.latitude)
      .set('longitude', place.longitude)
      .set('current', 'temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,weather_code,is_day')
      .set('timezone', 'auto');

    return this.getJson<ForecastResponse>(this.forecastUrl, forecastParams).pipe(
      switchMap((forecast) => {
        const localDate = this.getLocalDate(forecast.timezone);
        const offset = this.getTimeZoneOffset(forecast.timezone);

        return this.getAstronomy(place, localDate, offset).pipe(
          catchError((error: unknown) => {
            if (error instanceof WeatherConnectionError || error instanceof WeatherServiceError) {
              return of(this.emptyAstronomy());
            }
            return throwError(() => error);
          }),
          map((astronomy) => this.toViewModel(place, forecast, astronomy))
        );
      })
    );
  }

  private toCitySuggestions(places: Place[]): CitySuggestion[] {
    const seen = new Set<string>();

    return places.reduce<CitySuggestion[]>((suggestions, place) => {
      const country = this.getCountryName(place);
      const admin = place.admin1?.trim();
      const key = place.id
        ? `geonames-${place.id}`
        : `${this.normalizeText(place.name)}-${this.normalizeText(country)}-${place.latitude.toFixed(5)}-${place.longitude.toFixed(5)}`;

      if (seen.has(key)) return suggestions;

      seen.add(key);
      suggestions.push({
        id: `${key}-${place.latitude}-${place.longitude}`,
        name: place.name,
        country,
        admin1: admin,
        admin2: place.admin2?.trim(),
        countryCode: place.country_code?.trim().toUpperCase(),
        latitude: place.latitude,
        longitude: place.longitude,
        label: this.getPlaceLabel(place, country)
      });

      return suggestions;
    }, []).slice(0, 5);
  }

  private getPlaceLabel(place: Place, country = this.getCountryName(place)): string {
    const admin = place.admin1?.trim();
    const shouldShowAdmin = admin && this.normalizeText(admin) !== this.normalizeText(place.name) && this.normalizeText(admin) !== this.normalizeText(country);

    return shouldShowAdmin ? `${place.name}, ${admin}, ${country}` : `${place.name}, ${country}`;
  }

  private getSearchName(query: string): string {
    return query.split(',')[0].trim();
  }

  private getAstronomy(place: Place, date: string, offset: string): Observable<AstronomyData> {
    const latitude = place.latitude.toFixed(4);
    const longitude = place.longitude.toFixed(4);
    const cacheKey = `${latitude},${longitude},${date},${offset}`;
    const cached = this.astronomyCache.get(cacheKey);
    if (cached) return of(cached);

    const todayParams = this.getAstronomyParams(latitude, longitude, date, offset);
    const tomorrowParams = this.getAstronomyParams(latitude, longitude, this.addDaysToDate(date, 1), offset);

    return forkJoin({
      sunToday: this.getJson<AstronomyResponse>(`${this.astronomyUrl}/sun`, todayParams),
      sunTomorrow: this.getJson<AstronomyResponse>(`${this.astronomyUrl}/sun`, tomorrowParams),
      moonToday: this.getJson<AstronomyResponse>(`${this.astronomyUrl}/moon`, todayParams),
      moonTomorrow: this.getJson<AstronomyResponse>(`${this.astronomyUrl}/moon`, tomorrowParams)
    }).pipe(
      map(({ sunToday, sunTomorrow, moonToday, moonTomorrow }) => ({
        sunRise: this.getEventTime(sunToday, 'sunrise') ?? this.getEventTime(sunTomorrow, 'sunrise'),
        sunSet: this.getEventTime(sunToday, 'sunset') ?? this.getEventTime(sunTomorrow, 'sunset'),
        moonRise: this.getEventTime(moonToday, 'moonrise') ?? this.getEventTime(moonTomorrow, 'moonrise'),
        moonSet: this.getEventTime(moonToday, 'moonset') ?? this.getEventTime(moonTomorrow, 'moonset')
      })),
      tap((astronomy) => this.astronomyCache.set(cacheKey, astronomy))
    );
  }

  private getAstronomyParams(latitude: string, longitude: string, date: string, offset: string): HttpParams {
    return new HttpParams()
      .set('lat', latitude)
      .set('lon', longitude)
      .set('date', date)
      .set('offset', offset);
  }

  private toViewModel(place: Place, forecast: ForecastResponse, astronomy: AstronomyData): WeatherViewModel {
    const cloudCover = forecast.current.cloud_cover;
    const weatherCode = this.getEffectiveWeatherCode(forecast.current.weather_code, cloudCover);
    const localIso = this.getLocalIso(forecast.timezone);
    const isDaylight = astronomy.sunRise && astronomy.sunSet
      ? this.isDaylight(localIso, astronomy.sunRise, astronomy.sunSet)
      : forecast.current.is_day === 1;

    return {
      city: place.name,
      country: this.getCountryName(place),
      locationLabel: this.getPlaceLabel(place),
      temperature: Math.round(forecast.current.temperature_2m),
      windSpeed: Math.round(forecast.current.wind_speed_10m),
      humidity: forecast.current.relative_humidity_2m,
      cloudCover,
      description: this.getWeatherDescription(weatherCode),
      iconUrl: this.getWeatherIconUrl(weatherCode, isDaylight),
      theme: this.getWeatherTheme(weatherCode, cloudCover, isDaylight, localIso, astronomy.sunRise, astronomy.sunSet),
      weatherCode,
      timeZone: forecast.timezone,
      isDaylight,
      sunRise: astronomy.sunRise,
      sunSet: astronomy.sunSet,
      moonRise: astronomy.moonRise,
      moonSet: astronomy.moonSet,
      sunRiseLabel: this.formatEventTime(astronomy.sunRise, this.getLocalDate(forecast.timezone)),
      sunSetLabel: this.formatEventTime(astronomy.sunSet, this.getLocalDate(forecast.timezone)),
      moonRiseLabel: this.formatEventTime(astronomy.moonRise, this.getLocalDate(forecast.timezone)),
      moonSetLabel: this.formatEventTime(astronomy.moonSet, this.getLocalDate(forecast.timezone)),
      localDateTime: this.formatCurrentDateTime(forecast.timezone),
      updatedAtLabel: this.formatApiDateTime(forecast.current.time)
    };
  }

  private getCountryName(place: Place): string {
    const country = place.country?.trim();
    const countryCode = place.country_code?.trim().toUpperCase();
    const admin = place.admin1?.trim();

    if (country) return country;
    if (countryCode && this.countryNamesByCode[countryCode]) return this.countryNamesByCode[countryCode];
    if (admin) return admin;

    return 'Nazione non disponibile';
  }

  private getEventTime(response: AstronomyResponse, key: string): string | null {
    const value = response.properties?.[key];
    return typeof value === 'object' && value !== null && 'time' in value ? value.time ?? null : null;
  }

  private findBestPlace(query: string, places: Place[]): Place | null {
    const normalizedQuery = this.normalizeText(query);
    const exactLabel = places.find((place) => this.normalizeText(this.getPlaceLabel(place)) === normalizedQuery);
    if (exactLabel) return exactLabel;

    const acceptedNames = this.getAcceptedNames(this.getSearchName(query));

    return places.find((place) => {
      const normalizedName = this.normalizeText(place.name);
      return acceptedNames.some((acceptedName) => {
        return normalizedName === acceptedName || normalizedName.startsWith(`${acceptedName} `);
      });
    }) ?? null;
  }

  private getAcceptedNames(query: string): string[] {
    const normalizedQuery = this.normalizeText(query);
    return [normalizedQuery, ...(this.cityAliases[normalizedQuery] ?? [])];
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private getJson<T>(url: string, params: HttpParams): Observable<T> {
    return this.http.get<T>(url, { params }).pipe(
      timeout(this.requestTimeout),
      catchError((error: unknown) => throwError(() => this.toWeatherError(error)))
    );
  }

  private toWeatherError(error: unknown): Error {
    if (
      error instanceof WeatherConnectionError ||
      error instanceof WeatherServiceError ||
      error instanceof WeatherNotFoundError
    ) {
      return error;
    }
    if (error instanceof TimeoutError || (error instanceof HttpErrorResponse && error.status === 0)) {
      return new WeatherConnectionError();
    }
    return new WeatherServiceError();
  }

  private emptyAstronomy(): AstronomyData {
    return { sunRise: null, sunSet: null, moonRise: null, moonSet: null };
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
      timeZone
    }).formatToParts(new Date());

    const part = (type: Intl.DateTimeFormatPartTypes): string => {
      return parts.find((item) => item.type === type)?.value ?? '00';
    };

    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
  }

  private getLocalDate(timeZone: string): string {
    return this.getLocalIso(timeZone).slice(0, 10);
  }

  private getTimeZoneOffset(timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset'
    }).formatToParts(new Date());
    const value = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+0';
    const match = value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);

    if (!match) return '+00:00';

    const [, sign, hours, minutes = '00'] = match;
    return `${sign}${hours.padStart(2, '0')}:${minutes}`;
  }

  private isDaylight(localIso: string, sunrise: string | null, sunset: string | null): boolean {
    if (!sunrise || !sunset) return false;
    return localIso >= this.normalizeEventIso(sunrise) && localIso < this.normalizeEventIso(sunset);
  }

  private formatCurrentDateTime(timeZone: string): string {
    const parts = new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZone
    }).formatToParts(new Date());

    const part = (type: Intl.DateTimeFormatPartTypes): string => {
      return parts.find((item) => item.type === type)?.value ?? '';
    };

    return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')}:${part('second')}`;
  }

  private formatApiDateTime(localDateTime: string): string {
    const [date, time = ''] = localDateTime.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour = '00', minute = '00'] = time.split(':');
    const monthName = this.months[(month || 1) - 1];

    return `${day} ${monthName} ${year}, alle ${hour}:${minute}`;
  }

  private formatEventTime(value: string | null, referenceDate: string): string {
    if (!value) return 'Non disponibile';

    const eventIso = this.normalizeEventIso(value);
    const [eventDate, time = ''] = eventIso.split('T');
    const [hour = '00', minute = '00'] = time.split(':');
    const label = `${hour}:${minute}`;

    if (eventDate === referenceDate) return label;

    const [year, month, day] = eventDate.split('-').map(Number);
    return `${day} ${this.months[(month || 1) - 1]} ${year}, ${label}`;
  }

  private normalizeEventIso(value: string): string {
    return value.replace(/([+-]\d{2}:\d{2}|Z)$/, '');
  }


  private getEffectiveWeatherCode(code: number, cloudCover: number): number {
    if (![0, 1, 2, 3].includes(code)) return code;
    if (cloudCover <= 15) return 0;
    if (cloudCover <= 65) return 2;
    return 3;
  }
  private getWeatherDescription(code: number): string {
    if (code === 0) return 'Sereno';
    if ([1, 2].includes(code)) return 'Parzialmente nuvoloso';
    if (code === 3) return 'Nuvoloso';
    if ([45, 48].includes(code)) return 'Nebbia';
    if ([51, 53, 55, 56, 57].includes(code)) return 'Pioviggine';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Pioggia';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Neve';
    if ([95, 96, 99].includes(code)) return 'Temporale';
    return 'Condizioni variabili';
  }

  private getWeatherIconUrl(code: number, isDaylight: boolean): string {
    const moment = isDaylight ? 'day' : 'night';
    let iconCode = isDaylight ? 113 : 113;

    if ([1, 2].includes(code)) iconCode = 116;
    if (code === 3) iconCode = 122;
    if ([45, 48].includes(code)) iconCode = 248;
    if ([51, 53, 55, 56, 57].includes(code)) iconCode = 266;
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) iconCode = 302;
    if ([71, 73, 75, 77, 85, 86].includes(code)) iconCode = 338;
    if ([95, 96, 99].includes(code)) iconCode = 389;

    return `/weather_icons/${moment}/${iconCode}.png`;
  }

  private getWeatherTheme(
    code: number,
    cloudCover: number,
    isDaylight: boolean,
    localIso: string,
    sunrise: string | null,
    sunset: string | null
  ): WeatherTheme {
    if ([95, 96, 99].includes(code)) return 'stormy';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snowy';
    if ([61, 63, 65, 66, 67, 80, 81, 82, 51, 53, 55, 56, 57].includes(code)) return 'rainy';
    if ([45, 48].includes(code)) return 'foggy';
    if ([1, 2].includes(code) || (cloudCover > 15 && cloudCover <= 65)) {
      return isDaylight ? 'partly-cloudy' : 'partly-cloudy-night';
    }
    if (code === 3 || cloudCover > 65) {
      return isDaylight ? 'cloudy' : 'cloudy-night';
    }
    if (this.isNearSunrise(localIso, sunrise)) return 'sunrise';
    if (this.isNearSunset(localIso, sunset)) return this.isAfterSunset(localIso, sunset) ? 'sunset-glow' : 'sunset';
    if (!isDaylight) return 'night';
    if (code === 0) return 'sunny';
    return 'default';
  }

  private isNearSunset(localIso: string, sunset: string | null): boolean {
    if (!sunset) return false;
    const value = this.normalizeEventIso(sunset);
    return localIso >= this.addMinutes(value, -60) && localIso < this.addMinutes(value, 30);
  }

  private isAfterSunset(localIso: string, sunset: string | null): boolean {
    return sunset ? localIso >= this.normalizeEventIso(sunset) : false;
  }
  private isNearSunrise(localIso: string, sunrise: string | null): boolean {
    if (!sunrise) return false;
    const value = this.normalizeEventIso(sunrise);
    return localIso >= this.addMinutes(value, -30) && localIso < this.addMinutes(value, 60);
  }

  private addMinutes(localIso: string, minutes: number): string {
    const [date, time] = localIso.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const value = new Date(year, month - 1, day, hour, minute + minutes, 0);
    const pad = (input: number): string => input.toString().padStart(2, '0');

    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:00`;
  }

  private addDaysToDate(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const value = new Date(year, month - 1, day + days);
    const pad = (input: number): string => input.toString().padStart(2, '0');

    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
}
