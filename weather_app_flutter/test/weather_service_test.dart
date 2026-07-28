import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:weather_app_flutter/services/weather_service.dart';

void main() {
  test('distingue la connessione assente', () async {
    final reservedSocket = await ServerSocket.bind(
      InternetAddress.loopbackIPv4,
      0,
    );
    final port = reservedSocket.port;
    await reservedSocket.close();

    final service = WeatherService(
      geocodingUrl: 'http://127.0.0.1:$port/v1/search',
    );

    await expectLater(
      service.searchCities('Roma'),
      throwsA(isA<WeatherConnectionException>()),
    );
  });

  test('distingue una citta non trovata', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(server.close);

    server.listen((request) async {
      request.response.headers.contentType = ContentType.json;
      request.response.write('{"results": []}');
      await request.response.close();
    });

    final service = WeatherService(
      geocodingUrl: 'http://127.0.0.1:${server.port}/v1/search',
    );

    await expectLater(
      service.getWeather('Roma'),
      throwsA(isA<WeatherNotFoundException>()),
    );
  });

  test('distingue un servizio meteo non disponibile', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(server.close);

    server.listen((request) async {
      request.response.statusCode = HttpStatus.serviceUnavailable;
      await request.response.close();
    });

    final service = WeatherService(
      geocodingUrl: 'http://127.0.0.1:${server.port}/v1/search',
    );

    await expectLater(
      service.searchCities('Roma'),
      throwsA(isA<WeatherServiceException>()),
    );
  });
}
