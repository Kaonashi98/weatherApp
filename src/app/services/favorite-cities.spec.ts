import { TestBed } from '@angular/core/testing';
import { FavoriteCitiesService, FavoriteCity } from './favorite-cities';

describe('FavoriteCitiesService', () => {
  let service: FavoriteCitiesService;
  const roma: FavoriteCity = { id: 'roma', name: 'Roma', country: 'Italia', latitude: 41.89, longitude: 12.51, label: 'Roma, Lazio, Italia' };

  beforeEach(() => { localStorage.clear(); service = TestBed.inject(FavoriteCitiesService); });
  afterEach(() => localStorage.clear());

  it('aggiunge e rimuove un preferito persistendolo nel browser', () => {
    expect(service.toggle(roma)).toEqual([roma]);
    expect(service.contains(roma)).toBe(true);
    expect(service.toggle(roma)).toEqual([]);
  });

  it('ignora dati locali non validi', () => {
    localStorage.setItem('weatherapp_favorite_cities_v2', JSON.stringify([{ name: 'incompleto' }]));
    expect(service.load()).toEqual([]);
  });
});
