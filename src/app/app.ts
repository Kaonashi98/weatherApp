import { Component, HostBinding, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription, timer } from 'rxjs';
import { CitySuggestion, WeatherService, WeatherViewModel } from './services/weather';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.css'
})
export class AppComponent implements OnDestroy {
  readonly quickCities = [
    'Roma',
    'Milano',
    'Londra',
    'Parigi',
    'Madrid',
    'Berlino',
    'Amsterdam',
    'Bruxelles',
    'Vienna',
    'Praga',
    'Atene',
    'Lisbona',
    'Dublino',
    'Oslo',
    'Stoccolma',
    'Copenaghen',
    'Helsinki',
    'Varsavia',
    'Zurigo',
    'New York',
    'Los Angeles',
    'Toronto',
    'Citt\u00e0 del Messico',
    'Buenos Aires',
    'Rio de Janeiro',
    'Tokyo',
    'Seoul',
    'Pechino',
    'Shanghai',
    'Hong Kong',
    'Singapore'
  ];

  city = '';
  weatherData: WeatherViewModel | null = null;
  suggestions: CitySuggestion[] = [];
  selectedSuggestion: CitySuggestion | null = null;
  isLoading = false;
  isSuggesting = false;
  showSuggestions = false;
  errorMessage = '';
  isWeatherPanelOpen = false;
  isWeatherPanelClosing = false;

  private searchSubscription: Subscription | null = null;
  private suggestionSubscription: Subscription | null = null;
  private suggestionTimer: ReturnType<typeof setTimeout> | null = null;
  private closeSuggestionsTimer: ReturnType<typeof setTimeout> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private weatherPanelCloseTimer: ReturnType<typeof setTimeout> | null = null;

  @HostBinding('class')
  get themeClass(): string {
    return `theme-${this.weatherData?.theme ?? 'default'}`;
  }

  @HostBinding('style.--orb-top')
  get orbTop(): string | null {
    return this.weatherData ? `${this.getSolarOrbTop(this.weatherData)}vh` : null;
  }

  constructor(private readonly weatherService: WeatherService) {}

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.suggestionSubscription?.unsubscribe();
    this.clearSuggestionTimer();
    this.clearCloseSuggestionsTimer();
    this.stopLocalClock();
    this.clearWeatherPanelCloseTimer();
  }

  getWeather(): void {
    const city = this.city.trim();

    if (!city) {
      this.suggestions = [];
      this.showSuggestions = false;
      this.closeWeatherPanelNow();
      this.errorMessage = 'Inserisci il nome di una citt\u00e0.';
      this.weatherData = null;
      this.stopLocalClock();
      return;
    }

    if (city.length < 4) {
      this.suggestions = [];
      this.showSuggestions = false;
      this.closeWeatherPanelNow();
      this.errorMessage = 'Scrivi almeno 4 lettere, cos\u00ec evitiamo risultati casuali.';
      this.weatherData = null;
      this.stopLocalClock();
      return;
    }

    this.searchSubscription?.unsubscribe();
    this.suggestionSubscription?.unsubscribe();
    this.clearSuggestionTimer();
    this.isSuggesting = false;
    this.showSuggestions = false;
    this.isLoading = true;
    this.openWeatherPanel();
    this.errorMessage = '';

    const selectedSuggestion = this.selectedSuggestion?.label === city ? this.selectedSuggestion : null;
    const weatherRequest = selectedSuggestion
      ? this.weatherService.getWeatherForSuggestion(selectedSuggestion)
      : this.weatherService.getWeather(city);

    this.searchSubscription = forkJoin({
      data: weatherRequest,
      delay: timer(1000)
    }).subscribe({
      next: ({ data }) => {
        this.weatherData = data;
        this.isLoading = false;
        this.searchSubscription = null;
        this.startLocalClock();
      },
      error: () => {
        this.weatherData = null;
        this.isLoading = false;
        this.searchSubscription = null;
        this.stopLocalClock();
        this.closeWeatherPanelNow();
        this.errorMessage = 'Citt\u00e0 non trovata. Controlla il nome oppure prova con un nome pi\u00f9 specifico.';
      }
    });
  }

  onCityChange(value: string): void {
    this.city = value;
    this.selectedSuggestion = null;
    this.errorMessage = '';
    this.closeWeatherPanelNow();
    this.queueCitySuggestions(value);
  }

  openSuggestions(): void {
    this.clearCloseSuggestionsTimer();
    this.showSuggestions = this.suggestions.length > 0 || this.isSuggesting;
  }

  closeSuggestionsSoon(): void {
    this.clearCloseSuggestionsTimer();
    this.closeSuggestionsTimer = setTimeout(() => {
      this.showSuggestions = false;
      this.closeSuggestionsTimer = null;
    }, 120);
  }

  selectCitySuggestion(suggestion: CitySuggestion): void {
    this.clearCloseSuggestionsTimer();
    this.city = suggestion.label;
    this.selectedSuggestion = suggestion;
    this.suggestions = [];
    this.isSuggesting = false;
    this.showSuggestions = false;
    this.errorMessage = '';
    this.getWeather();
  }

  getSuggestionMeta(suggestion: CitySuggestion): string {
    return suggestion.admin1 && suggestion.label.includes(`, ${suggestion.admin1},`)
      ? `${suggestion.admin1}, ${suggestion.country}`
      : suggestion.country;
  }

  isSelectedCity(city: string): boolean {
    return this.normalizeCity(this.city.split(',')[0]) === this.normalizeCity(city);
  }

  showSearchPanel(): void {
    if (!this.isWeatherPanelOpen || this.isWeatherPanelClosing) {
      return;
    }

    this.clearWeatherPanelCloseTimer();
    this.isWeatherPanelClosing = true;
    this.weatherPanelCloseTimer = setTimeout(() => {
      this.isWeatherPanelOpen = false;
      this.isWeatherPanelClosing = false;
      this.weatherPanelCloseTimer = null;
    }, 320);
  }

  cercaRapida(city: string): void {
    this.city = city;
    this.selectedSuggestion = null;
    this.suggestions = [];
    this.showSuggestions = false;
    this.errorMessage = '';
    this.getWeather();
  }

  private openWeatherPanel(): void {
    this.clearWeatherPanelCloseTimer();
    this.isWeatherPanelClosing = false;
    this.isWeatherPanelOpen = true;
  }

  private closeWeatherPanelNow(): void {
    this.clearWeatherPanelCloseTimer();
    this.isWeatherPanelOpen = false;
    this.isWeatherPanelClosing = false;
  }

  private clearWeatherPanelCloseTimer(): void {
    if (this.weatherPanelCloseTimer) {
      clearTimeout(this.weatherPanelCloseTimer);
      this.weatherPanelCloseTimer = null;
    }
  }
  private queueCitySuggestions(value: string): void {
    const query = value.trim();
    this.clearSuggestionTimer();
    this.suggestionSubscription?.unsubscribe();

    if (query.length < 2) {
      this.suggestions = [];
      this.isSuggesting = false;
      this.showSuggestions = false;
      return;
    }

    this.isSuggesting = true;
    this.showSuggestions = true;

    this.suggestionTimer = setTimeout(() => {
      this.suggestionSubscription = this.weatherService.searchCities(query).subscribe({
        next: (suggestions) => {
          if (this.normalizeCity(this.city).startsWith(this.normalizeCity(query))) {
            this.suggestions = suggestions;
            this.showSuggestions = suggestions.length > 0;
          }

          this.isSuggesting = false;
          this.suggestionSubscription = null;
        },
        error: () => {
          this.suggestions = [];
          this.isSuggesting = false;
          this.showSuggestions = false;
          this.suggestionSubscription = null;
        }
      });
      this.suggestionTimer = null;
    }, 260);
  }

  private clearSuggestionTimer(): void {
    if (this.suggestionTimer) {
      clearTimeout(this.suggestionTimer);
      this.suggestionTimer = null;
    }
  }

  private clearCloseSuggestionsTimer(): void {
    if (this.closeSuggestionsTimer) {
      clearTimeout(this.closeSuggestionsTimer);
      this.closeSuggestionsTimer = null;
    }
  }

  private normalizeCity(city: string): string {
    return city
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private getSolarOrbTop(weather: WeatherViewModel): number {
    if (!weather.sunRise || !weather.sunSet) return 7;

    const localIso = this.getLocalIso(weather.timeZone);
    const sunrise = this.normalizeEventIso(weather.sunRise);
    const sunset = this.normalizeEventIso(weather.sunSet);

    if (weather.theme === 'sunrise') {
      const progress = this.getProgress(localIso, this.addMinutes(sunrise, -30), this.addMinutes(sunrise, 60));
      return this.lerp(72, 42, this.easeOut(progress));
    }

    if (weather.theme === 'sunset') {
      const progress = this.getProgress(localIso, this.addMinutes(sunset, -60), sunset);
      return this.lerp(42, 72, this.easeIn(progress));
    }

    if (weather.theme === 'sunny' || weather.theme === 'partly-cloudy') {
      const progress = this.getProgress(localIso, sunrise, sunset);
      return 68 - Math.sin(Math.PI * progress) * 54;
    }

    return weather.theme.includes('night') ? 7 : 18;
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
    const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((item) => item.type === type)?.value ?? '00';

    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
  }

  private normalizeEventIso(value: string): string {
    return value.replace(/([+-]\d{2}:\d{2}|Z)$/, '');
  }

  private addMinutes(localIso: string, minutes: number): string {
    const date = this.toLocalDate(localIso);
    date.setMinutes(date.getMinutes() + minutes);

    return this.toLocalIso(date);
  }

  private getProgress(localIso: string, startIso: string, endIso: string): number {
    const start = this.toLocalDate(startIso).getTime();
    const end = this.toLocalDate(endIso).getTime();
    const current = this.toLocalDate(localIso).getTime();

    return this.clamp((current - start) / (end - start));
  }

  private toLocalDate(localIso: string): Date {
    const [date, time] = localIso.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute, second = 0] = time.split(':').map(Number);

    return new Date(year, month - 1, day, hour, minute, second);
  }

  private toLocalIso(value: Date): string {
    const pad = (input: number): string => input.toString().padStart(2, '0');

    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }

  private lerp(start: number, end: number, progress: number): number {
    return start + (end - start) * progress;
  }

  private easeIn(progress: number): number {
    return progress * progress;
  }

  private easeOut(progress: number): number {
    return 1 - Math.pow(1 - progress, 2);
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
  private startLocalClock(): void {
    this.stopLocalClock();
    this.clockTimer = setInterval(() => {
      if (this.weatherData) {
        this.weatherData = this.weatherService.refreshLiveFields(this.weatherData);
      }
    }, 1000);
  }

  private stopLocalClock(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

}
