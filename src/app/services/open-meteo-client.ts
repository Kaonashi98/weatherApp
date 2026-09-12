import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError, timeout, TimeoutError } from 'rxjs';
import {
  WeatherConnectionError,
  WeatherNotFoundError,
  WeatherServiceError,
} from './weather-errors';

@Injectable({ providedIn: 'root' })
export class OpenMeteoClient {
  private readonly requestTimeout = 12_000;

  constructor(private readonly http: HttpClient) {}

  get<T>(url: string, params: HttpParams): Observable<T> {
    return this.http.get<T>(url, { params }).pipe(
      timeout(this.requestTimeout),
      catchError((error: unknown) => throwError(() => this.toWeatherError(error))),
    );
  }

  private toWeatherError(error: unknown): Error {
    if (
      error instanceof WeatherConnectionError ||
      error instanceof WeatherServiceError ||
      error instanceof WeatherNotFoundError
    ) {
      return error;
    }

    return error instanceof TimeoutError ||
      (error instanceof HttpErrorResponse && error.status === 0)
      ? new WeatherConnectionError()
      : new WeatherServiceError();
  }
}
