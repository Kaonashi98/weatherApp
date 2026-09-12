import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { AppLanguageCode } from './app-language';
import { OpenMeteoClient } from './open-meteo-client';
import { CitySuggestion, OpenMeteoPlace } from './weather.models';

type GeocodingResponse = { results?: OpenMeteoPlace[] };

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';
  private readonly aliases: Record<string, string[]> = {
    seoul: ['seul'],
    seul: ['seoul'],
    beijing: ['pechino'],
    pechino: ['beijing'],
    'new york': ['new york city'],
    'citta del messico': ['mexico city'],
    'rio de janeiro': ['rio'],
  };
  private language: AppLanguageCode = 'it';

  constructor(private readonly client: OpenMeteoClient) {}

  setLanguage(language: AppLanguageCode): void {
    this.language = language;
  }

  search(query: string): Observable<CitySuggestion[]> {
    const name = this.searchName(query);
    if (name.length < 2) return of([]);

    return this.request(name).pipe(map((response) => this.toSuggestions(response.results ?? [])));
  }

  findBest(query: string): Observable<OpenMeteoPlace | null> {
    return this.request(this.searchName(query)).pipe(
      map((response) => this.findBestPlace(query, response.results ?? [])),
    );
  }

  private request(name: string): Observable<GeocodingResponse> {
    const params = new HttpParams()
      .set('name', name)
      .set('count', 8)
      .set('language', this.language)
      .set('format', 'json');
    return this.client.get<GeocodingResponse>(this.geocodingUrl, params);
  }

  private toSuggestions(places: OpenMeteoPlace[]): CitySuggestion[] {
    const seen = new Set<string>();
    return places
      .reduce<CitySuggestion[]>((result, place) => {
        if (
          !Number.isFinite(place.latitude) ||
          !Number.isFinite(place.longitude) ||
          !place.country
        ) {
          return result;
        }

        const key = place.id
          ? `geonames-${place.id}`
          : `${this.normalize(place.name)}-${place.latitude.toFixed(4)}-${place.longitude.toFixed(4)}`;
        if (seen.has(key)) return result;

        seen.add(key);
        result.push({
          id: key,
          name: place.name,
          country: this.country(place),
          admin1: place.admin1?.trim(),
          admin2: place.admin2?.trim(),
          countryCode: place.country_code?.trim().toUpperCase(),
          latitude: place.latitude,
          longitude: place.longitude,
          label: this.placeLabel(place),
        });
        return result;
      }, [])
      .slice(0, 5);
  }

  private findBestPlace(query: string, places: OpenMeteoPlace[]): OpenMeteoPlace | null {
    const exact = places.find(
      (place) => this.normalize(this.placeLabel(place)) === this.normalize(query),
    );
    if (exact) return exact;

    const name = this.normalize(this.searchName(query));
    const accepted = [name, ...(this.aliases[name] ?? [])];
    return (
      places.find((place) =>
        accepted.some(
          (item) =>
            this.normalize(place.name) === item ||
            this.normalize(place.name).startsWith(`${item} `),
        ),
      ) ?? null
    );
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

  private searchName(query: string): string {
    return query.split(',')[0].trim();
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
