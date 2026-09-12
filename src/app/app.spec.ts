import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { AppComponent } from './app';
import { WeatherService } from './services/weather';
import { WeatherViewModel } from './services/weather.models';

describe('AppComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('weatherapp_language_v2', 'it');
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('crea correttamente il componente principale', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('mostra il pannello di ricerca meteo', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Controlla il meteo della tua città');
  });

  it('mostra un messaggio di validazione quando la citta e vuota', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.getWeather();

    expect(app.errorMessage).toContain('Inserisci il nome');
    expect(app.weatherData).toBeNull();
  });

  it('mostra le citta recenti salvate e permette di cancellarle', () => {
    localStorage.setItem(
      'weatherapp_recent_cities_v1',
      JSON.stringify(['Bisceglie, Puglia, Italia']),
    );
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Recenti');
    expect(compiled.textContent).toContain('Bisceglie, Puglia, Italia');

    const clearButton = [...compiled.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Cancella'),
    );
    clearButton?.click();
    fixture.detectChanges();

    expect(compiled.textContent).not.toContain('Bisceglie, Puglia, Italia');
    expect(localStorage.getItem('weatherapp_recent_cities_v1')).toBeNull();
  });

  it('cancella il testo e apre le informazioni privacy', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.city = 'Roma';
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.clear-input') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(app.city).toBe('');

    (compiled.querySelector('.legal-link') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Privacy, fonti e licenze');
    expect(compiled.querySelector('[role="dialog"]')).toBeTruthy();
    expect(compiled.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe(
      'info-title',
    );
  });

  it('ignora una risposta precedente quando parte una ricerca più recente', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const weather = TestBed.inject(WeatherService);
    const first = new Subject<WeatherViewModel>();
    const second = new Subject<WeatherViewModel>();
    vi.spyOn(weather, 'getWeather').mockReturnValueOnce(first).mockReturnValueOnce(second);

    app.city = 'Roma';
    app.getWeather();
    app.city = 'Milano';
    app.getWeather();
    second.next({
      locationLabel: 'Milano, Lombardia, Italia',
      updatedAt: Date.now(),
    } as WeatherViewModel);
    first.next({ locationLabel: 'Roma, Lazio, Italia', updatedAt: Date.now() } as WeatherViewModel);

    expect(app.weatherData?.locationLabel).toBe('Milano, Lombardia, Italia');
    fixture.destroy();
  });

  it('permette di navigare i suggerimenti con la tastiera', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.suggestions = [
      {
        id: 'roma',
        name: 'Roma',
        country: 'Italia',
        latitude: 41.9,
        longitude: 12.5,
        label: 'Roma, Italia',
      },
      {
        id: 'rome',
        name: 'Rome',
        country: 'USA',
        latitude: 43.2,
        longitude: -75.5,
        label: 'Rome, USA',
      },
    ];
    app.showSuggestions = true;

    app.onCityKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    expect(app.activeSuggestionIndex).toBe(0);
    app.onCityKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
    expect(app.activeSuggestionIndex).toBe(1);
    app.onCityKeydown(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(app.showSuggestions).toBe(false);
  });
});
