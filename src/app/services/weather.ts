import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, map, Observable, of, switchMap, throwError } from 'rxjs';

export type WeatherTheme = 'default' | 'sunny' | 'partly-cloudy' | 'partly-cloudy-night' | 'cloudy' | 'cloudy-night' | 'rainy' | 'snowy' | 'stormy' | 'foggy' | 'sunrise' | 'sunset' | 'night';

export type WeatherViewModel = {
  city: string;
  country: string;
  temperature: number;
  windSpeed: number;
  humidity: number;
  cloudCover: number;
  description: string;
  iconUrl: string;
  theme: WeatherTheme;
  weatherCode: number;
  timeZone: string;
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
  latitude: number;
  longitude: number;
  label: string;
};

type Place = {
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
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

  constructor(private readonly http: HttpClient) {}

  searchCities(query: string): Observable<CitySuggestion[]> {
    const searchName = this.getSearchName(query);

    if (searchName.length < 2) return of([]);

    const params = new HttpParams()
      .set('name', searchName)
      .set('count', 8)
      .set('language', 'it')
      .set('format', 'json');

    return this.http.get<GeocodingResponse>(this.geocodingUrl, { params }).pipe(
      map((geocoding) => this.toCitySuggestions(geocoding.results ?? []))
    );
  }

  getWeatherForSuggestion(suggestion: CitySuggestion): Observable<WeatherViewModel> {
    return this.getWeatherForPlace({
      name: suggestion.name,
      country: suggestion.country,
      admin1: suggestion.admin1,
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
      .set('count', 5)
      .set('language', 'it')
      .set('format', 'json');

    return this.http.get<GeocodingResponse>(this.geocodingUrl, { params: geocodingParams }).pipe(
      switchMap((geocoding) => {
        const place = this.findBestPlace(searchName, geocoding.results ?? []);

        if (!place) {
          return throwError(() => new Error('Citta non trovata.'));
        }

        return this.getWeatherForPlace(place);
      })
    );
  }

  refreshLiveFields(weather: WeatherViewModel): WeatherViewModel {
    const localIso = this.getLocalIso(weather.timeZone);
    const isDaylight = this.isDaylight(localIso, weather.sunRise, weather.sunSet);

    return {
      ...weather,
      localDateTime: this.formatCurrentDateTime(weather.timeZone),
      iconUrl: this.getWeatherIconUrl(weather.weatherCode, isDaylight),
      theme: this.getWeatherTheme(weather.weatherCode, weather.cloudCover, isDaylight, localIso, weather.sunRise, weather.sunSet)
    };
  }

  private getWeatherForPlace(place: Place): Observable<WeatherViewModel> {
    const forecastParams = new HttpParams()
      .set('latitude', place.latitude)
      .set('longitude', place.longitude)
      .set('current', 'temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,weather_code')
      .set('timezone', 'auto');

    return this.http.get<ForecastResponse>(this.forecastUrl, { params: forecastParams }).pipe(
      switchMap((forecast) => {
        const localDate = this.getLocalDate(forecast.timezone);
        const offset = this.getTimeZoneOffset(forecast.timezone);

        return this.getAstronomy(place, localDate, offset).pipe(
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
      const key = `${this.normalizeText(place.name)}-${this.normalizeText(country)}-${admin ? this.normalizeText(admin) : ''}`;

      if (seen.has(key)) return suggestions;

      seen.add(key);
      suggestions.push({
        id: `${key}-${place.latitude}-${place.longitude}`,
        name: place.name,
        country,
        admin1: admin,
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
    const todayParams = this.getAstronomyParams(place, date, offset);
    const tomorrowParams = this.getAstronomyParams(place, this.addDaysToDate(date, 1), offset);

    return forkJoin({
      sunToday: this.http.get<AstronomyResponse>(`${this.astronomyUrl}/sun`, { params: todayParams }),
      sunTomorrow: this.http.get<AstronomyResponse>(`${this.astronomyUrl}/sun`, { params: tomorrowParams }),
      moonToday: this.http.get<AstronomyResponse>(`${this.astronomyUrl}/moon`, { params: todayParams }),
      moonTomorrow: this.http.get<AstronomyResponse>(`${this.astronomyUrl}/moon`, { params: tomorrowParams })
    }).pipe(
      map(({ sunToday, sunTomorrow, moonToday, moonTomorrow }) => ({
        sunRise: this.getEventTime(sunToday, 'sunrise') ?? this.getEventTime(sunTomorrow, 'sunrise'),
        sunSet: this.getEventTime(sunToday, 'sunset') ?? this.getEventTime(sunTomorrow, 'sunset'),
        moonRise: this.getEventTime(moonToday, 'moonrise') ?? this.getEventTime(moonTomorrow, 'moonrise'),
        moonSet: this.getEventTime(moonToday, 'moonset') ?? this.getEventTime(moonTomorrow, 'moonset')
      }))
    );
  }

  private getAstronomyParams(place: Place, date: string, offset: string): HttpParams {
    return new HttpParams()
      .set('lat', place.latitude)
      .set('lon', place.longitude)
      .set('date', date)
      .set('offset', offset);
  }

  private toViewModel(place: Place, forecast: ForecastResponse, astronomy: AstronomyData): WeatherViewModel {
    const cloudCover = forecast.current.cloud_cover;
    const weatherCode = this.getEffectiveWeatherCode(forecast.current.weather_code, cloudCover);
    const localIso = this.getLocalIso(forecast.timezone);
    const isDaylight = this.isDaylight(localIso, astronomy.sunRise, astronomy.sunSet);

    return {
      city: place.name,
      country: this.getCountryName(place),
      temperature: Math.round(forecast.current.temperature_2m),
      windSpeed: Math.round(forecast.current.wind_speed_10m),
      humidity: forecast.current.relative_humidity_2m,
      cloudCover,
      description: this.getWeatherDescription(weatherCode),
      iconUrl: this.getWeatherIconUrl(weatherCode, isDaylight),
      theme: this.getWeatherTheme(weatherCode, cloudCover, isDaylight, localIso, astronomy.sunRise, astronomy.sunSet),
      weatherCode,
      timeZone: forecast.timezone,
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
    const acceptedNames = this.getAcceptedNames(query);

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

    return `https://cdn.weatherapi.com/weather/128x128/${moment}/${iconCode}.png`;
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
    if (!isDaylight) {
      if ([1, 2].includes(code) || (cloudCover > 15 && cloudCover <= 65)) return 'partly-cloudy-night';
      if (code === 3 || cloudCover > 65) return 'cloudy-night';
      return 'night';
    }
    if (this.isNearSunrise(localIso, sunrise)) return 'sunrise';
    if (this.isNearSunset(localIso, sunset)) return 'sunset';
    if ([1, 2].includes(code)) return 'partly-cloudy';
    if (code === 3) return 'cloudy';
    if (code === 0) return 'sunny';
    return 'default';
  }

  private isNearSunset(localIso: string, sunset: string | null): boolean {
    if (!sunset) return false;
    const value = this.normalizeEventIso(sunset);
    return localIso >= this.addMinutes(value, -45) && localIso < this.addMinutes(value, 15);
  }

  private isNearSunrise(localIso: string, sunrise: string | null): boolean {
    if (!sunrise) return false;
    const value = this.normalizeEventIso(sunrise);
    return localIso >= this.addMinutes(value, -15) && localIso < this.addMinutes(value, 45);
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
