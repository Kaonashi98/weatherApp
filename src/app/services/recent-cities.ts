import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RecentCitiesService {
  static readonly maxRecentCities = 5;

  private readonly storageKey = 'weatherapp_recent_cities_v1';

  load(): string[] {
    const storedCities = this.read();
    const normalizedCities = this.uniqueNonEmpty(
      storedCities.map((city) => this.compactLocationLabel(city))
    ).slice(0, RecentCitiesService.maxRecentCities);

    if (!this.sameItems(storedCities, normalizedCities)) {
      this.write(normalizedCities);
    }

    return normalizedCities;
  }

  remember(city: string): string[] {
    const updated = this.uniqueNonEmpty([city, ...this.load()]).slice(
      0,
      RecentCitiesService.maxRecentCities
    );
    this.write(updated);
    return updated;
  }

  clear(): void {
    try {
      globalThis.localStorage?.removeItem(this.storageKey);
    } catch {
      // La cronologia e una comodita: un browser che blocca lo storage non deve
      // impedire la consultazione del meteo.
    }
  }

  private read(): string[] {
    try {
      const value = globalThis.localStorage?.getItem(this.storageKey);
      if (!value) return [];

      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  private write(cities: string[]): void {
    try {
      globalThis.localStorage?.setItem(this.storageKey, JSON.stringify(cities));
    } catch {
      // Vedi clear(): la funzionalita meteo resta disponibile senza storage.
    }
  }

  private uniqueNonEmpty(cities: string[]): string[] {
    const normalized = new Set<string>();
    const result: string[] = [];

    for (const city of cities) {
      const trimmed = city.trim();
      if (!trimmed) continue;

      const key = this.normalize(trimmed);
      if (!normalized.add(key)) continue;

      const parts = this.normalizedParts(trimmed);
      const moreDetailedMatch = result.some((savedCity) => {
        const savedParts = this.normalizedParts(savedCity);
        return this.isSameLocationVariant(parts, savedParts) && savedParts.length >= parts.length;
      });
      if (moreDetailedMatch) continue;

      for (let index = result.length - 1; index >= 0; index--) {
        const savedParts = this.normalizedParts(result[index]);
        if (this.isSameLocationVariant(parts, savedParts) && savedParts.length < parts.length) {
          normalized.delete(this.normalize(result[index]));
          result.splice(index, 1);
        }
      }

      result.push(trimmed);
    }

    return result;
  }

  private normalizedParts(value: string): string[] {
    return value
      .split(',')
      .map((part) => this.normalize(part))
      .filter(Boolean);
  }

  private isSameLocationVariant(first: string[], second: string[]): boolean {
    if (first.length < 2 || second.length < 2) return false;
    if (first[0] !== second[0] || first.at(-1) !== second.at(-1)) return false;

    const firstDetails = new Set(first.slice(1, -1));
    const secondDetails = new Set(second.slice(1, -1));
    return (
      [...firstDetails].every((part) => secondDetails.has(part)) ||
      [...secondDetails].every((part) => firstDetails.has(part))
    );
  }

  private compactLocationLabel(value: string): string {
    const parts = value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length < 4) return parts.join(', ');
    return [parts[0], parts.at(-2), parts.at(-1)].join(', ');
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  private sameItems(first: string[], second: string[]): boolean {
    return first.length === second.length && first.every((value, index) => value === second[index]);
  }
}
