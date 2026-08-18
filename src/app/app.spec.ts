import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app';

describe('AppComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
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
    expect(compiled.textContent).toContain('Controlla il meteo attuale');
  });

  it('mostra un messaggio di validazione quando la citta e vuota', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.getWeather();

    expect(app.errorMessage).toContain('Inserisci il nome');
    expect(app.weatherData).toBeNull();
  });

  it('mostra le citta recenti salvate e permette di cancellarle', () => {
    localStorage.setItem('weatherapp_recent_cities_v1', JSON.stringify(['Bisceglie, Puglia, Italia']));
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Recenti');
    expect(compiled.textContent).toContain('Bisceglie, Puglia, Italia');

    const clearButton = [...compiled.querySelectorAll('button')].find((button) => button.textContent?.includes('Cancella'));
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
  });

  it('mostra l\'indicatore finche ci sono altre citta sotto', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    const cityLists = fixture.nativeElement.querySelector('.city-lists') as HTMLElement;
    Object.defineProperties(cityLists, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 900 },
      scrollTop: { configurable: true, value: 0, writable: true }
    });

    app.updateCityScrollHint();
    expect(app.showCityScrollHint).toBe(true);

    cityLists.scrollTop = 600;
    app.updateCityScrollHint();
    expect(app.showCityScrollHint).toBe(false);
  });
});
