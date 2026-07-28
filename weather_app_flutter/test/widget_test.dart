import 'dart:ui' show Size;

import 'package:flutter/material.dart' show TextField;
import 'package:flutter_test/flutter_test.dart';
import 'package:weather_app_flutter/main.dart';

void main() {
  testWidgets('mostra la schermata meteo iniziale', (tester) async {
    await tester.pumpWidget(const WeatherApp());

    expect(
      find.text('Controlla il meteo attuale della tua citt\u00e0'),
      findsOneWidget,
    );
    expect(find.text('Cerca'), findsOneWidget);
  });

  testWidgets('mantiene la ricerca entro il pannello su Pixel', (tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const WeatherApp());

    expect(tester.takeException(), isNull);
  });

  testWidgets('valida una ricerca vuota o troppo corta', (tester) async {
    await tester.pumpWidget(const WeatherApp());

    await tester.tap(find.text('Cerca'));
    await tester.pump();

    expect(find.text('Inserisci il nome di una citt\u00e0.'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Rom');
    await tester.tap(find.text('Cerca'));
    await tester.pump();

    expect(
      find.text(
        'Scrivi almeno 4 lettere, cos\u00ec evitiamo risultati casuali.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('rende accessibili privacy, fonti e licenze', (tester) async {
    await tester.pumpWidget(const WeatherApp());

    await tester.ensureVisible(find.text('Privacy e fonti'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Privacy e fonti'));
    await tester.pumpAndSettle();

    expect(find.text('Privacy, fonti e licenze'), findsOneWidget);
    expect(find.text('Dati trattati'), findsOneWidget);
    expect(find.text('Fonti e licenze'), findsOneWidget);
  });
}
