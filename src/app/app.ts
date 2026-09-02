import { ChangeDetectionStrategy, Component, HostBinding, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AppLanguageCode, AppLanguageMode, AppLanguageService } from './services/app-language';
import { FavoriteCitiesService, FavoriteCity } from './services/favorite-cities';
import {
  CitySuggestion, DailyForecast, HourlyForecast, WeatherConnectionError, WeatherNotFoundError,
  WeatherService, WeatherServiceError, WeatherViewModel
} from './services/weather';
import { RecentCitiesService } from './services/recent-cities';

type WeatherView = 'now' | 'forecast';
type LabelKey = keyof typeof LABELS;
const LABELS = {
  search: ['Ricerca', 'Search'], title: ['Controlla il meteo della tua città', 'Check the weather in your city'],
  subtitle: ['Condizioni attuali e previsioni affidabili, in pochi secondi.', 'Current conditions and reliable forecasts in seconds.'],
  city: ['Città', 'City'], wait: ['Attendi...', 'Please wait...'], searchButton: ['Cerca', 'Search'],
  searching: ['Ricerca località...', 'Searching locations...'], recent: ['Recenti', 'Recent'], clear: ['Cancella', 'Clear'],
  favorites: ['Preferiti', 'Favourites'], suggested: ['Città suggerite', 'Suggested cities'],
  legal: ['Privacy, fonti e licenze', 'Privacy, sources and licences'], changeCity: ['Cambia città', 'Change city'],
  ready: ['Pronto per la ricerca', 'Ready to search'], emptyTitle: ['Cerca una città per visualizzare il meteo.', 'Search for a city to see the weather.'],
  emptyCopy: ['Troverai condizioni attuali, prossime 24 ore e previsioni per 7 giorni.', 'You will find current conditions, the next 24 hours and a 7-day forecast.'],
  location: ['Località', 'Location'], now: ['Adesso', 'Now'], forecast: ['Previsioni', 'Forecast'],
  humidity: ['Umidità', 'Humidity'], wind: ['Vento', 'Wind'], localTime: ['Ora locale', 'Local time'],
  sunrise: ['Alba sole', 'Sunrise'], sunset: ['Tramonto sole', 'Sunset'], moonrise: ['Alba luna', 'Moonrise'], moonset: ['Tramonto luna', 'Moonset'],
  updated: ['Meteo aggiornato', 'Weather updated'], hourly: ['Prossime 24 ore', 'Next 24 hours'], daily: ['Prossimi 7 giorni', 'Next 7 days'],
  rainChance: ['Probabilità pioggia', 'Rain chance'], feelsLike: ['Percepita', 'Feels like'], gusts: ['Raffiche', 'Gusts'],
  precipitation: ['Precipitazioni', 'Precipitation'], rain: ['Pioggia', 'Rain'], showers: ['Rovesci', 'Showers'], snow: ['Neve', 'Snow'], uv: ['Indice UV massimo', 'Maximum UV index'],
  minimum: ['Minima', 'Minimum'], maximum: ['Massima', 'Maximum'], details: ['Dettagli', 'Details'],
  refresh: ['Aggiorna', 'Refresh'], refreshing: ['Aggiornamento...', 'Refreshing...'], stale: ['I dati potrebbero non essere aggiornati.', 'The data may be out of date.'],
  addFavorite: ['Aggiungi ai preferiti', 'Add to favourites'], removeFavorite: ['Rimuovi dai preferiti', 'Remove from favourites'],
  settings: ['Impostazioni', 'Settings'], language: ['Lingua', 'Language'], system: ['Sistema', 'System'], italian: ['Italiano', 'Italian'], english: ['Inglese', 'English'],
  close: ['Chiudi', 'Close'], infoCopy: ['WeatherApp è gratuita, senza pubblicità, account, acquisti o tracciamento. Recenti, preferiti e lingua vengono salvati soltanto in questo browser.', 'WeatherApp is free, with no ads, accounts, purchases or tracking. Recent cities, favourites and language are stored only in this browser.'],
  sourceCopy: ['Ricerche, dati meteo, previsioni ed eventi di sole e luna provengono da Open-Meteo. Icone e immagini atmosferiche sono risorse locali.', 'Search, weather data, forecasts and sun and moon events come from Open-Meteo. Icons and atmospheric images are local assets.']
} as const;

@Component({ selector: 'app-root', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './app.html', styleUrl: './app.css', changeDetection: ChangeDetectionStrategy.Eager })
export class AppComponent implements OnDestroy {
  city = '';
  weatherData: WeatherViewModel | null = null;
  recentCities: string[] = [];
  favorites: FavoriteCity[] = [];
  suggestions: CitySuggestion[] = [];
  selectedSuggestion: CitySuggestion | null = null;
  selectedDay: DailyForecast | null = null;
  selectedHour: HourlyForecast | null = null;
  weatherView: WeatherView = 'now';
  languageMode: AppLanguageMode;
  languageCode: AppLanguageCode;
  isLoading = false;
  isRefreshing = false;
  isSuggesting = false;
  showSuggestions = false;
  errorMessage = '';
  isWeatherPanelOpen = false;
  isWeatherPanelClosing = false;
  isInfoPanelOpen = false;
  isSettingsOpen = false;

  private searchSubscription: Subscription | null = null;
  private suggestionSubscription: Subscription | null = null;
  private suggestionTimer: ReturnType<typeof setTimeout> | null = null;
  private closeSuggestionsTimer: ReturnType<typeof setTimeout> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private weatherPanelCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private weatherRequestId = 0;

  constructor(
    private readonly weatherService: WeatherService,
    private readonly recentCitiesService: RecentCitiesService,
    private readonly favoriteCitiesService: FavoriteCitiesService,
    private readonly appLanguageService: AppLanguageService
  ) {
    this.languageMode = this.appLanguageService.load();
    this.languageCode = this.appLanguageService.resolve(this.languageMode);
    this.weatherService.setLanguage(this.languageCode);
    this.applyDocumentLanguage();
    this.recentCities = this.recentCitiesService.load();
    this.favorites = this.favoriteCitiesService.load();
  }

  @HostBinding('class') get themeClass(): string { return `theme-${this.weatherData?.theme ?? 'default'}`; }
  @HostBinding('style.--orb-top') get orbTop(): string | null { return this.weatherData ? `${this.getSolarOrbTop(this.weatherData)}vh` : null; }

  get quickCities(): string[] {
    return this.languageCode === 'it'
      ? ['Roma', 'Milano', 'Londra', 'Parigi', 'Madrid', 'Berlino', 'Amsterdam', 'Bruxelles', 'Vienna', 'Praga', 'Atene', 'Lisbona', 'Dublino', 'Oslo', 'Stoccolma', 'Copenaghen', 'Helsinki', 'Varsavia', 'Zurigo', 'New York', 'Los Angeles', 'Toronto', 'Città del Messico', 'Buenos Aires', 'Rio de Janeiro', 'Tokyo', 'Seoul', 'Pechino', 'Shanghai', 'Hong Kong', 'Singapore']
      : ['Rome', 'Milan', 'London', 'Paris', 'Madrid', 'Berlin', 'Amsterdam', 'Brussels', 'Vienna', 'Prague', 'Athens', 'Lisbon', 'Dublin', 'Oslo', 'Stockholm', 'Copenhagen', 'Helsinki', 'Warsaw', 'Zurich', 'New York', 'Los Angeles', 'Toronto', 'Mexico City', 'Buenos Aires', 'Rio de Janeiro', 'Tokyo', 'Seoul', 'Beijing', 'Shanghai', 'Hong Kong', 'Singapore'];
  }
  get isDataStale(): boolean { return !!this.weatherData && Date.now() - this.weatherData.updatedAt > 15 * 60 * 1000; }
  t(key: LabelKey): string { return LABELS[key][this.languageCode === 'it' ? 0 : 1]; }

  ngOnDestroy(): void {
    this.weatherRequestId++; this.searchSubscription?.unsubscribe(); this.suggestionSubscription?.unsubscribe();
    this.clearSuggestionTimer(); this.clearCloseSuggestionsTimer(); this.stopLocalClock(); this.clearWeatherPanelCloseTimer();
  }

  getWeather(): void {
    const city = this.city.trim();
    if (!city || city.length < 4) {
      this.resetWeather();
      this.errorMessage = !city
        ? (this.languageCode === 'it' ? 'Inserisci il nome di una città.' : 'Enter a city name.')
        : (this.languageCode === 'it' ? 'Scrivi almeno 4 lettere, così evitiamo risultati casuali.' : 'Enter at least 4 letters to avoid random results.');
      return;
    }
    const selected = this.selectedSuggestion?.label === city ? this.selectedSuggestion : null;
    this.runWeatherRequest(selected ? this.weatherService.getWeatherForSuggestion(selected) : this.weatherService.getWeather(city), false);
  }

  refreshWeather(): void {
    if (!this.weatherData || this.isRefreshing) return;
    const suggestion = this.currentFavorite();
    this.runWeatherRequest(this.weatherService.getWeatherForSuggestion(suggestion), true);
  }

  private runWeatherRequest(request: ReturnType<WeatherService['getWeather']>, refresh: boolean): void {
    this.searchSubscription?.unsubscribe(); this.suggestionSubscription?.unsubscribe(); this.clearSuggestionTimer();
    this.isSuggesting = false; this.showSuggestions = false; this.isLoading = !refresh; this.isRefreshing = refresh;
    this.openWeatherPanel(); this.errorMessage = ''; const requestId = ++this.weatherRequestId;
    this.searchSubscription = request.subscribe({
      next: (data) => {
        if (requestId !== this.weatherRequestId) return;
        this.weatherData = data; this.city = data.locationLabel; this.recentCities = this.recentCitiesService.remember(data.locationLabel);
        this.isLoading = false; this.isRefreshing = false; this.searchSubscription = null; this.startLocalClock();
      },
      error: (error: unknown) => {
        if (requestId !== this.weatherRequestId) return;
        this.isLoading = false; this.isRefreshing = false; this.searchSubscription = null;
        if (!refresh) { this.weatherData = null; this.stopLocalClock(); this.closeWeatherPanelNow(); }
        this.errorMessage = this.weatherError(error);
      }
    });
  }

  onCityChange(value: string): void {
    if (this.isLoading) { this.weatherRequestId++; this.searchSubscription?.unsubscribe(); this.isLoading = false; }
    this.city = value; this.selectedSuggestion = null; this.errorMessage = ''; this.closeWeatherPanelNow(); this.queueCitySuggestions(value);
  }
  openSuggestions(): void { this.clearCloseSuggestionsTimer(); this.showSuggestions = this.suggestions.length > 0 || this.isSuggesting; }
  closeSuggestionsSoon(): void { this.clearCloseSuggestionsTimer(); this.closeSuggestionsTimer = setTimeout(() => { this.showSuggestions = false; }, 120); }
  selectCitySuggestion(suggestion: CitySuggestion): void { this.city = suggestion.label; this.selectedSuggestion = suggestion; this.suggestions = []; this.showSuggestions = false; this.getWeather(); }
  getSuggestionMeta(suggestion: CitySuggestion): string { return suggestion.admin1 && suggestion.label.includes(`, ${suggestion.admin1},`) ? `${suggestion.admin1}, ${suggestion.country}` : suggestion.country; }
  isSelectedCity(value: string): boolean { return this.normalize(this.city) === this.normalize(value) || this.normalize(this.city.split(',')[0]) === this.normalize(value); }
  cercaRapida(city: string): void { this.city = city; this.selectedSuggestion = null; this.suggestions = []; this.showSuggestions = false; this.getWeather(); }
  searchFavorite(favorite: FavoriteCity): void { this.city = favorite.label; this.selectedSuggestion = favorite; this.getWeather(); }
  clearRecentCities(): void { this.recentCitiesService.clear(); this.recentCities = []; }
  clearCityInput(): void { this.weatherRequestId++; this.searchSubscription?.unsubscribe(); this.suggestionSubscription?.unsubscribe(); this.city = ''; this.selectedSuggestion = null; this.resetWeather(); }
  setWeatherView(view: WeatherView): void { this.weatherView = view; }
  openDay(day: DailyForecast): void { this.selectedDay = day; }
  openHour(hour: HourlyForecast): void { this.selectedHour = hour; }
  closeDetails(): void { this.selectedDay = null; this.selectedHour = null; }
  openInfoPanel(): void { this.isInfoPanelOpen = true; }
  closeInfoPanel(): void { this.isInfoPanelOpen = false; }
  openSettings(): void { this.isSettingsOpen = true; }
  closeSettings(): void { this.isSettingsOpen = false; }

  setLanguageMode(mode: AppLanguageMode): void {
    this.languageMode = mode; this.appLanguageService.save(mode); this.languageCode = this.appLanguageService.resolve(mode);
    this.weatherService.setLanguage(this.languageCode); this.applyDocumentLanguage(); this.isSettingsOpen = false;
    if (this.weatherData) this.refreshWeather();
  }

  toggleFavorite(): void { if (this.weatherData) this.favorites = this.favoriteCitiesService.toggle(this.currentFavorite()); }
  isCurrentFavorite(): boolean { return !!this.weatherData && this.favoriteCitiesService.contains(this.currentFavorite()); }
  private currentFavorite(): FavoriteCity {
    const data = this.weatherData!;
    return { id: `${data.latitude},${data.longitude}`, name: data.city, country: data.country,
      admin1: data.admin1, admin2: data.admin2, countryCode: data.countryCode,
      latitude: data.latitude, longitude: data.longitude, label: data.locationLabel };
  }

  showSearchPanel(): void {
    if (!this.isWeatherPanelOpen || this.isWeatherPanelClosing) return;
    this.clearWeatherPanelCloseTimer(); this.isWeatherPanelClosing = true;
    this.weatherPanelCloseTimer = setTimeout(() => { this.isWeatherPanelOpen = false; this.isWeatherPanelClosing = false; }, 320);
  }
  @HostListener('document:keydown.escape') onEscape(): void {
    if (this.selectedDay || this.selectedHour) this.closeDetails(); else if (this.isSettingsOpen) this.closeSettings(); else if (this.isInfoPanelOpen) this.closeInfoPanel();
  }
  @HostListener('document:visibilitychange') onVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.hidden) this.stopLocalClock();
    else if (this.weatherData) { this.weatherData = this.weatherService.refreshLiveFields(this.weatherData); this.startLocalClock(); }
  }

  private queueCitySuggestions(value: string): void {
    const query = value.trim(); this.clearSuggestionTimer(); this.suggestionSubscription?.unsubscribe();
    if (query.length < 2) { this.suggestions = []; this.isSuggesting = false; this.showSuggestions = false; return; }
    this.isSuggesting = true; this.showSuggestions = true;
    this.suggestionTimer = setTimeout(() => {
      this.suggestionSubscription = this.weatherService.searchCities(query).subscribe({
        next: (items) => { if (this.normalize(this.city).startsWith(this.normalize(query))) this.suggestions = items; this.showSuggestions = items.length > 0; this.isSuggesting = false; },
        error: (error: unknown) => { this.suggestions = []; this.showSuggestions = false; this.isSuggesting = false; if (error instanceof WeatherConnectionError) this.errorMessage = this.weatherError(error); }
      });
    }, 260);
  }
  private resetWeather(): void { this.suggestions = []; this.showSuggestions = false; this.isLoading = false; this.isRefreshing = false; this.weatherData = null; this.closeWeatherPanelNow(); this.stopLocalClock(); }
  private openWeatherPanel(): void { this.clearWeatherPanelCloseTimer(); this.isWeatherPanelClosing = false; this.isWeatherPanelOpen = true; }
  private closeWeatherPanelNow(): void { this.clearWeatherPanelCloseTimer(); this.isWeatherPanelOpen = false; this.isWeatherPanelClosing = false; }
  private clearWeatherPanelCloseTimer(): void { if (this.weatherPanelCloseTimer) { clearTimeout(this.weatherPanelCloseTimer); this.weatherPanelCloseTimer = null; } }
  private clearSuggestionTimer(): void { if (this.suggestionTimer) { clearTimeout(this.suggestionTimer); this.suggestionTimer = null; } }
  private clearCloseSuggestionsTimer(): void { if (this.closeSuggestionsTimer) { clearTimeout(this.closeSuggestionsTimer); this.closeSuggestionsTimer = null; } }
  private normalize(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  private weatherError(error: unknown): string {
    if (error instanceof WeatherConnectionError) return this.languageCode === 'it' ? 'Connessione assente. Controlla la rete e riprova.' : 'No connection. Check your network and try again.';
    if (error instanceof WeatherServiceError) return this.languageCode === 'it' ? 'Il servizio meteo non è disponibile. Riprova tra poco.' : 'The weather service is unavailable. Try again shortly.';
    if (error instanceof WeatherNotFoundError) return this.languageCode === 'it' ? 'Città non trovata. Prova con un nome più specifico.' : 'City not found. Try a more specific name.';
    return this.languageCode === 'it' ? 'Non è stato possibile aggiornare il meteo.' : 'The weather could not be updated.';
  }
  private applyDocumentLanguage(): void {
    if (typeof document !== 'undefined') document.documentElement.lang = this.languageCode;
  }
  private startLocalClock(): void { this.stopLocalClock(); this.clockTimer = setInterval(() => { if (this.weatherData) this.weatherData = this.weatherService.refreshLiveFields(this.weatherData); }, 1000); }
  private stopLocalClock(): void { if (this.clockTimer) { clearInterval(this.clockTimer); this.clockTimer = null; } }

  private getSolarOrbTop(weather: WeatherViewModel): number {
    if (!weather.sunRise || !weather.sunSet) return 7;
    const local = this.localIso(weather.timeZone); const sunrise = this.cleanIso(weather.sunRise); const sunset = this.cleanIso(weather.sunSet);
    if (weather.theme === 'sunrise') return this.lerp(72, 42, this.easeOut(this.progress(local, this.addMinutes(sunrise, -30), this.addMinutes(sunrise, 60))));
    if (weather.theme === 'sunset') return this.lerp(42, 72, this.easeIn(this.progress(local, this.addMinutes(sunset, -60), sunset)));
    if (weather.theme === 'sunny' || weather.theme === 'partly-cloudy') return 68 - Math.sin(Math.PI * this.progress(local, sunrise, sunset)) * 54;
    return weather.theme.includes('night') ? 7 : 18;
  }
  private localIso(zone: string): string { const p = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: zone }).formatToParts(new Date()); const v = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? '00'; return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}:${v('second')}`; }
  private cleanIso(value: string): string { return value.replace(/([+-]\d{2}:\d{2}|Z)$/, ''); }
  private addMinutes(iso: string, minutes: number): string { const [d, t] = iso.split('T'); const [y, m, day] = d.split('-').map(Number); const [h, min, s = 0] = t.split(':').map(Number); const v = new Date(y, m - 1, day, h, min + minutes, s); const pad = (n: number) => n.toString().padStart(2, '0'); return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}T${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`; }
  private progress(value: string, start: string, end: string): number { const parse = (iso: string) => new Date(iso).getTime(); return Math.min(1, Math.max(0, (parse(value) - parse(start)) / (parse(end) - parse(start)))); }
  private lerp(a: number, b: number, p: number): number { return a + (b - a) * p; }
  private easeIn(p: number): number { return p * p; }
  private easeOut(p: number): number { return 1 - Math.pow(1 - p, 2); }
}
