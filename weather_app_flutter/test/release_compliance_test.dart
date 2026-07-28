import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:weather_app_flutter/models/weather_models.dart';
import 'package:weather_app_flutter/services/weather_service.dart';

void main() {
  test(
    'arrotonda le coordinate, identifica il client e usa la cache MET',
    () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final astronomyRequests = <HttpRequest>[];
      addTearDown(server.close);

      server.listen((request) async {
        request.response.headers.contentType = ContentType.json;

        if (request.uri.path == '/geocoding') {
          request.response.write(
            jsonEncode({
              'results': [
                {
                  'name': 'Roma',
                  'country': 'Italia',
                  'latitude': 41.89193,
                  'longitude': 12.51133,
                },
              ],
            }),
          );
        } else if (request.uri.path == '/forecast') {
          request.response.write(
            jsonEncode({
              'utc_offset_seconds': 7200,
              'current': {
                'temperature_2m': 28,
                'relative_humidity_2m': 48,
                'cloud_cover': 10,
                'wind_speed_10m': 7,
                'weather_code': 0,
                'is_day': 1,
                'time': '2026-07-28T12:00',
              },
            }),
          );
        } else if (request.uri.path.startsWith('/astronomy/')) {
          astronomyRequests.add(request);
          final isSun = request.uri.path.endsWith('/sun');
          request.response.write(
            jsonEncode({
              'properties': isSun
                  ? {
                      'sunrise': {'time': '2026-07-28T05:58:00+02:00'},
                      'sunset': {'time': '2026-07-28T20:31:00+02:00'},
                    }
                  : {
                      'moonrise': {'time': '2026-07-28T19:20:00+02:00'},
                      'moonset': {'time': '2026-07-28T03:45:00+02:00'},
                    },
            }),
          );
        } else {
          request.response.statusCode = HttpStatus.notFound;
        }

        await request.response.close();
      });

      final baseUrl = 'http://127.0.0.1:${server.port}';
      final service = WeatherService(
        geocodingUrl: '$baseUrl/geocoding',
        forecastUrl: '$baseUrl/forecast',
        astronomyUrl: '$baseUrl/astronomy',
      );
      addTearDown(service.dispose);

      final first = await service.getWeather('Roma');
      final second = await service.getWeather('Roma');

      expect(first.city, 'Roma');
      expect(first.iconUrl, endsWith('/day/113.png'));
      expect(second.sunRiseLabel, isNot('Non disponibile'));
      expect(astronomyRequests, hasLength(4));
      for (final request in astronomyRequests) {
        expect(request.uri.queryParameters['lat'], '41.8919');
        expect(request.uri.queryParameters['lon'], '12.5113');
        expect(
          request.headers.value(HttpHeaders.userAgentHeader),
          contains('weatherapp.help@outlook.com'),
        );
      }
    },
  );

  group('sfondo basato sul meteo e sugli eventi solari locali', () {
    WeatherViewModel sampleWeather({int code = 0, int cloudCover = 5}) {
      return WeatherViewModel(
        city: 'Roma',
        country: 'Italia',
        temperature: 25,
        windSpeed: 8,
        humidity: 45,
        cloudCover: cloudCover,
        description: 'Sereno',
        iconUrl: 'assets/weather_icons/day/113.png',
        theme: WeatherTheme.standard,
        weatherCode: code,
        utcOffsetSeconds: 0,
        isDaylight: true,
        sunRise: '2026-07-28T06:00:00+00:00',
        sunSet: '2026-07-28T20:00:00+00:00',
        moonRise: null,
        moonSet: null,
        sunRiseLabel: '06:00',
        sunSetLabel: '20:00',
        moonRiseLabel: 'Non disponibile',
        moonSetLabel: 'Non disponibile',
        localDateTime: '',
        updatedAtLabel: '',
      );
    }

    WeatherTheme themeAt(int hour, int minute, {int code = 0}) {
      final service = WeatherService(
        now: () => DateTime.utc(2026, 7, 28, hour, minute),
      );
      addTearDown(service.dispose);
      return service.refreshLiveFields(sampleWeather(code: code)).theme;
    }

    test('usa alba, giorno, tramonto, bagliore e notte alle ore corrette', () {
      expect(themeAt(5, 45), WeatherTheme.sunrise);
      expect(themeAt(12, 0), WeatherTheme.sunny);
      expect(themeAt(19, 30), WeatherTheme.sunset);
      expect(themeAt(20, 10), WeatherTheme.sunsetGlow);
      expect(themeAt(23, 0), WeatherTheme.night);
    });

    test('le condizioni meteo hanno priorità sulla fascia dell’alba', () {
      expect(themeAt(5, 45, code: 61), WeatherTheme.rainy);
      expect(themeAt(5, 45, code: 95), WeatherTheme.stormy);
    });
  });
}
