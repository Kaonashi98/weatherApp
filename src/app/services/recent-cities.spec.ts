import { TestBed } from '@angular/core/testing';
import { RecentCitiesService } from './recent-cities';

describe('RecentCitiesService', () => {
  let service: RecentCitiesService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(RecentCitiesService);
  });

  afterEach(() => localStorage.clear());

  it('salva le ultime cinque citta dalla piu recente senza doppioni', () => {
    for (const city of [
      'Roma, Italia',
      'Milano, Italia',
      'Torino, Italia',
      'Bologna, Italia',
      'Firenze, Italia',
      'Napoli, Italia',
      'napoli, italia'
    ]) {
      service.remember(city);
    }

    expect(service.load()).toEqual([
      'napoli, italia',
      'Firenze, Italia',
      'Bologna, Italia',
      'Torino, Italia',
      'Milano, Italia'
    ]);
  });

  it('compatta le etichette e conserva localita omonime in regioni diverse', () => {
    service.remember('Bisceglie, BAT, Puglia, Italia');
    service.remember('Bisceglie, Campania, Italia');

    expect(service.load()).toEqual([
      'Bisceglie, Campania, Italia',
      'Bisceglie, Puglia, Italia'
    ]);
  });

  it('cancella tutta la cronologia locale', () => {
    service.remember('Roma, Italia');
    service.clear();

    expect(service.load()).toEqual([]);
  });
});
