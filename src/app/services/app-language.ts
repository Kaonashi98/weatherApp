import { Injectable } from '@angular/core';

export type AppLanguageMode = 'system' | 'it' | 'en';
export type AppLanguageCode = 'it' | 'en';

@Injectable({ providedIn: 'root' })
export class AppLanguageService {
  private readonly storageKey = 'weatherapp_language_v2';

  load(): AppLanguageMode {
    try {
      const value = globalThis.localStorage?.getItem(this.storageKey);
      return value === 'it' || value === 'en' || value === 'system' ? value : 'system';
    } catch {
      return 'system';
    }
  }

  save(mode: AppLanguageMode): void {
    try {
      globalThis.localStorage?.setItem(this.storageKey, mode);
    } catch {
      // La lingua di sistema rimane disponibile anche senza memoria locale.
    }
  }

  resolve(mode: AppLanguageMode): AppLanguageCode {
    if (mode === 'it' || mode === 'en') return mode;
    const browserLanguage = globalThis.navigator?.language?.toLowerCase() ?? 'it';
    return browserLanguage.startsWith('en') ? 'en' : 'it';
  }
}
