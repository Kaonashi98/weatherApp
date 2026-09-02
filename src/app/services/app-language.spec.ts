import { TestBed } from '@angular/core/testing';
import { AppLanguageService } from './app-language';

describe('AppLanguageService', () => {
  let service: AppLanguageService;
  beforeEach(() => { localStorage.clear(); service = TestBed.inject(AppLanguageService); });
  afterEach(() => localStorage.clear());

  it('salva e ricarica la lingua scelta', () => {
    service.save('en');
    expect(service.load()).toBe('en');
    expect(service.resolve('en')).toBe('en');
  });

  it('usa la modalità di sistema come valore iniziale', () => expect(service.load()).toBe('system'));
});
