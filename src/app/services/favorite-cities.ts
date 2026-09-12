import { Injectable } from '@angular/core';
import { CitySuggestion } from './weather.models';

export type FavoriteCity = Pick<
  CitySuggestion,
  'id' | 'name' | 'country' | 'admin1' | 'admin2' | 'countryCode' | 'latitude' | 'longitude' | 'label'
>;

@Injectable({ providedIn: 'root' })
export class FavoriteCitiesService {
  private readonly storageKey = 'weatherapp_favorite_cities_v2';

  load(): FavoriteCity[] {
    try {
      const raw = globalThis.localStorage?.getItem(this.storageKey);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((value): value is FavoriteCity => this.isFavoriteCity(value));
    } catch {
      return [];
    }
  }

  toggle(city: FavoriteCity): FavoriteCity[] {
    const favorites = this.load();
    const key = this.stableKey(city);
    const existing = favorites.findIndex((item) => this.stableKey(item) === key);
    const updated = existing >= 0
      ? favorites.filter((_, index) => index !== existing)
      : [city, ...favorites];
    this.write(updated);
    return updated;
  }

  contains(city: FavoriteCity): boolean {
    const key = this.stableKey(city);
    return this.load().some((item) => this.stableKey(item) === key);
  }

  private stableKey(city: FavoriteCity): string {
    return `${city.latitude.toFixed(5)},${city.longitude.toFixed(5)}`;
  }

  private isFavoriteCity(value: unknown): value is FavoriteCity {
    if (!value || typeof value !== 'object') return false;
    const city = value as Partial<FavoriteCity>;
    return typeof city.id === 'string' &&
      typeof city.name === 'string' &&
      typeof city.country === 'string' &&
      typeof city.latitude === 'number' &&
      Number.isFinite(city.latitude) &&
      typeof city.longitude === 'number' &&
      Number.isFinite(city.longitude) &&
      typeof city.label === 'string';
  }

  private write(cities: FavoriteCity[]): void {
    try {
      globalThis.localStorage?.setItem(this.storageKey, JSON.stringify(cities));
    } catch {
      // I preferiti sono opzionali e non impediscono la consultazione meteo.
    }
  }
}
