import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import '../models/weather_models.dart';

class WeatherConnectionException implements Exception {
  const WeatherConnectionException();
}

class WeatherServiceException implements Exception {
  const WeatherServiceException();
}

class WeatherNotFoundException implements Exception {
  const WeatherNotFoundException();
}

class WeatherService {
  static const _defaultGeocodingUrl =
      'https://geocoding-api.open-meteo.com/v1/search';
  static const _defaultForecastUrl = 'https://api.open-meteo.com/v1/forecast';
  static const _defaultAstronomyUrl =
      'https://api.met.no/weatherapi/sunrise/3.0';
  static const _userAgent =
      'WeatherAppFlutter/1.0 weatherapp.help@outlook.com';

  WeatherService({
    String? geocodingUrl,
    String? forecastUrl,
    String? astronomyUrl,
    HttpClient? client,
    DateTime Function()? now,
  }) : _geocodingUrl = geocodingUrl ?? _defaultGeocodingUrl,
       _forecastUrl = forecastUrl ?? _defaultForecastUrl,
       _astronomyUrl = astronomyUrl ?? _defaultAstronomyUrl,
       _client = client ?? HttpClient(),
       _now = now ?? DateTime.now {
    _client.connectionTimeout = const Duration(seconds: 12);
  }

  final String _geocodingUrl;
  final String _forecastUrl;
  final String _astronomyUrl;
  final HttpClient _client;
  final DateTime Function() _now;
  final Map<String, Map<String, String?>> _astronomyCache = {};

  final Map<String, List<String>> _cityAliases = const {
    'seoul': ['seul'],
    'seul': ['seoul'],
    'beijing': ['pechino'],
    'pechino': ['beijing'],
    'new york': ['new york city'],
    'citta del messico': ['mexico city'],
    'rio de janeiro': ['rio'],
  };

  final Map<String, String> _countryNamesByCode = const {
    'AR': 'Argentina',
    'AT': 'Austria',
    'BE': 'Belgio',
    'BR': 'Brasile',
    'CA': 'Canada',
    'CH': 'Svizzera',
    'CN': 'Cina',
    'CZ': 'Repubblica Ceca',
    'DE': 'Germania',
    'DK': 'Danimarca',
    'ES': 'Spagna',
    'FI': 'Finlandia',
    'FR': 'Francia',
    'GB': 'Regno Unito',
    'GR': 'Grecia',
    'HK': 'Cina',
    'IE': 'Irlanda',
    'IT': 'Italia',
    'JP': 'Giappone',
    'KR': 'Corea del Sud',
    'MX': 'Messico',
    'NL': 'Paesi Bassi',
    'NO': 'Norvegia',
    'PL': 'Polonia',
    'PT': 'Portogallo',
    'SE': 'Svezia',
    'SG': 'Singapore',
    'TH': 'Thailandia',
    'US': 'Stati Uniti',
  };

  void dispose() {
    _client.close(force: true);
  }

  final List<String> _months = const [
    'gennaio',
    'febbraio',
    'marzo',
    'aprile',
    'maggio',
    'giugno',
    'luglio',
    'agosto',
    'settembre',
    'ottobre',
    'novembre',
    'dicembre',
  ];

  Future<List<CitySuggestion>> searchCities(String query) async {
    final searchName = _getSearchName(query);
    if (searchName.length < 2) return [];

    final json = await _getJson(
      Uri.parse(_geocodingUrl).replace(
        queryParameters: {
          'name': searchName,
          'count': '8',
          'language': 'it',
          'format': 'json',
        },
      ),
    );

    final results = (json['results'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    return _toCitySuggestions(results);
  }

  Future<WeatherViewModel> getWeatherForSuggestion(CitySuggestion suggestion) {
    return _getWeatherForPlace({
      'name': suggestion.name,
      'country': suggestion.country,
      'admin1': suggestion.admin1,
      'latitude': suggestion.latitude,
      'longitude': suggestion.longitude,
    });
  }

  Future<WeatherViewModel> getWeather(String city) async {
    final searchName = _getSearchName(city.trim());
    if (searchName.length < 4) {
      throw Exception('Nome citta troppo breve.');
    }

    final geocoding = await _getJson(
      Uri.parse(_geocodingUrl).replace(
        queryParameters: {
          'name': searchName,
          'count': '5',
          'language': 'it',
          'format': 'json',
        },
      ),
    );

    final places = (geocoding['results'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    final place = _findBestPlace(searchName, places);
    if (place == null) {
      throw const WeatherNotFoundException();
    }

    return _getWeatherForPlace(place);
  }

  WeatherViewModel refreshLiveFields(WeatherViewModel weather) {
    final localIso = _toLocalIso(_getLocalNow(weather.utcOffsetSeconds));
    final isDaylight = weather.sunRise == null || weather.sunSet == null
        ? weather.isDaylight
        : _isDaylight(localIso, weather.sunRise, weather.sunSet);

    return weather.copyWith(
      localDateTime: _formatCurrentDateTime(weather.utcOffsetSeconds),
      iconUrl: _getWeatherIconUrl(weather.weatherCode, isDaylight),
      isDaylight: isDaylight,
      theme: _getWeatherTheme(
        weather.weatherCode,
        weather.cloudCover,
        isDaylight,
        localIso,
        weather.sunRise,
        weather.sunSet,
      ),
    );
  }

  double solarOrbTop(WeatherViewModel weather) {
    if (weather.sunRise == null || weather.sunSet == null) return 0.07;
    final localIso = _toLocalIso(_getLocalNow(weather.utcOffsetSeconds));
    final sunrise = _normalizeEventIso(weather.sunRise!);
    final sunset = _normalizeEventIso(weather.sunSet!);

    if (weather.theme == WeatherTheme.sunrise) {
      final progress = _progress(
        localIso,
        _addMinutes(sunrise, -30),
        _addMinutes(sunrise, 60),
      );
      return _lerp(0.72, 0.42, _easeOut(progress));
    }

    if (weather.theme == WeatherTheme.sunset) {
      final progress = _progress(localIso, _addMinutes(sunset, -60), sunset);
      return _lerp(0.42, 0.72, _easeIn(progress));
    }

    if (weather.theme == WeatherTheme.sunny ||
        weather.theme == WeatherTheme.partlyCloudy) {
      final progress = _progress(localIso, sunrise, sunset);
      return 0.68 - sin(pi * progress) * 0.54;
    }

    return _isNightTheme(weather.theme) ? 0.07 : 0.18;
  }

  Future<WeatherViewModel> _getWeatherForPlace(
    Map<String, dynamic> place,
  ) async {
    final forecast = await _getJson(
      Uri.parse(_forecastUrl).replace(
        queryParameters: {
          'latitude': '${place['latitude']}',
          'longitude': '${place['longitude']}',
          'current':
              'temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,weather_code,is_day',
          'timezone': 'auto',
        },
      ),
    );

    final offsetSeconds =
        (forecast['utc_offset_seconds'] as num?)?.round() ?? 0;
    final localDate = _formatDate(_getLocalNow(offsetSeconds));
    final offset = _formatOffset(offsetSeconds);
    Map<String, String?> astronomy = const {};
    try {
      astronomy = await _getAstronomy(place, localDate, offset);
    } on WeatherConnectionException {
      // The core forecast remains useful when astronomical data is unavailable.
    } on WeatherServiceException {
      // The core forecast remains useful when astronomical data is unavailable.
    }

    return _toViewModel(place, forecast, astronomy);
  }

  Future<Map<String, dynamic>> _getJson(Uri uri) async {
    try {
      final request = await _client.getUrl(uri);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.userAgentHeader, _userAgent);
      final response = await request.close().timeout(
        const Duration(seconds: 12),
      );
      final body = await response
          .transform(utf8.decoder)
          .join()
          .timeout(const Duration(seconds: 12));

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw const WeatherServiceException();
      }

      return jsonDecode(body) as Map<String, dynamic>;
    } on WeatherServiceException {
      rethrow;
    } on SocketException {
      throw const WeatherConnectionException();
    } on HandshakeException {
      throw const WeatherConnectionException();
    } on TimeoutException {
      throw const WeatherConnectionException();
    } on HttpException {
      throw const WeatherServiceException();
    } on FormatException {
      throw const WeatherServiceException();
    } on TypeError {
      throw const WeatherServiceException();
    }
  }

  List<CitySuggestion> _toCitySuggestions(List<Map<String, dynamic>> places) {
    final seen = <String>{};
    final suggestions = <CitySuggestion>[];

    for (final place in places) {
      final country = _getCountryName(place);
      final admin = (place['admin1'] as String?)?.trim();
      final name = place['name'] as String? ?? '';
      final latitude = (place['latitude'] as num?)?.toDouble();
      final longitude = (place['longitude'] as num?)?.toDouble();
      if (name.isEmpty || latitude == null || longitude == null) continue;

      final key =
          '${_normalizeText(name)}-${_normalizeText(country)}-${admin == null ? '' : _normalizeText(admin)}';
      if (seen.contains(key)) continue;
      seen.add(key);

      suggestions.add(
        CitySuggestion(
          id: '$key-$latitude-$longitude',
          name: name,
          country: country,
          admin1: admin,
          latitude: latitude,
          longitude: longitude,
          label: _getPlaceLabel(place, country),
        ),
      );

      if (suggestions.length == 5) break;
    }

    return suggestions;
  }

  Future<Map<String, String?>> _getAstronomy(
    Map<String, dynamic> place,
    String date,
    String offset,
  ) async {
    final latitude = _formatCoordinate(place['latitude']);
    final longitude = _formatCoordinate(place['longitude']);
    final cacheKey = '$latitude,$longitude,$date,$offset';
    final cached = _astronomyCache[cacheKey];
    if (cached != null) return cached;

    final tomorrow = _addDaysToDate(date, 1);
    final requests = await Future.wait([
      _getAstronomyPart(latitude, longitude, date, offset, 'sun'),
      _getAstronomyPart(latitude, longitude, tomorrow, offset, 'sun'),
      _getAstronomyPart(latitude, longitude, date, offset, 'moon'),
      _getAstronomyPart(latitude, longitude, tomorrow, offset, 'moon'),
    ]);

    final astronomy = <String, String?>{
      'sunRise':
          _getEventTime(requests[0], 'sunrise') ??
          _getEventTime(requests[1], 'sunrise'),
      'sunSet':
          _getEventTime(requests[0], 'sunset') ??
          _getEventTime(requests[1], 'sunset'),
      'moonRise':
          _getEventTime(requests[2], 'moonrise') ??
          _getEventTime(requests[3], 'moonrise'),
      'moonSet':
          _getEventTime(requests[2], 'moonset') ??
          _getEventTime(requests[3], 'moonset'),
    };
    _astronomyCache[cacheKey] = astronomy;
    return astronomy;
  }

  Future<Map<String, dynamic>> _getAstronomyPart(
    String latitude,
    String longitude,
    String date,
    String offset,
    String type,
  ) {
    return _getJson(
      Uri.parse('$_astronomyUrl/$type').replace(
        queryParameters: {
          'lat': latitude,
          'lon': longitude,
          'date': date,
          'offset': offset,
        },
      ),
    );
  }

  WeatherViewModel _toViewModel(
    Map<String, dynamic> place,
    Map<String, dynamic> forecast,
    Map<String, String?> astronomy,
  ) {
    final current = forecast['current'] as Map<String, dynamic>;
    final offsetSeconds =
        (forecast['utc_offset_seconds'] as num?)?.round() ?? 0;
    final cloudCover = (current['cloud_cover'] as num?)?.round() ?? 0;
    final weatherCode = _getEffectiveWeatherCode(
      (current['weather_code'] as num?)?.round() ?? 0,
      cloudCover,
    );
    final localIso = _toLocalIso(_getLocalNow(offsetSeconds));
    final isDaylight =
        astronomy['sunRise'] == null || astronomy['sunSet'] == null
        ? (current['is_day'] as num?)?.round() == 1
        : _isDaylight(localIso, astronomy['sunRise'], astronomy['sunSet']);
    final referenceDate = _formatDate(_getLocalNow(offsetSeconds));

    return WeatherViewModel(
      city: place['name'] as String? ?? 'Localita',
      country: _getCountryName(place),
      temperature: (current['temperature_2m'] as num?)?.round() ?? 0,
      windSpeed: (current['wind_speed_10m'] as num?)?.round() ?? 0,
      humidity: (current['relative_humidity_2m'] as num?)?.round() ?? 0,
      cloudCover: cloudCover,
      description: _getWeatherDescription(weatherCode),
      iconUrl: _getWeatherIconUrl(weatherCode, isDaylight),
      theme: _getWeatherTheme(
        weatherCode,
        cloudCover,
        isDaylight,
        localIso,
        astronomy['sunRise'],
        astronomy['sunSet'],
      ),
      weatherCode: weatherCode,
      utcOffsetSeconds: offsetSeconds,
      isDaylight: isDaylight,
      sunRise: astronomy['sunRise'],
      sunSet: astronomy['sunSet'],
      moonRise: astronomy['moonRise'],
      moonSet: astronomy['moonSet'],
      sunRiseLabel: _formatEventTime(astronomy['sunRise'], referenceDate),
      sunSetLabel: _formatEventTime(astronomy['sunSet'], referenceDate),
      moonRiseLabel: _formatEventTime(astronomy['moonRise'], referenceDate),
      moonSetLabel: _formatEventTime(astronomy['moonSet'], referenceDate),
      localDateTime: _formatCurrentDateTime(offsetSeconds),
      updatedAtLabel: _formatApiDateTime(current['time'] as String? ?? ''),
    );
  }

  String _getCountryName(Map<String, dynamic> place) {
    final country = (place['country'] as String?)?.trim();
    final countryCode = (place['country_code'] as String?)
        ?.trim()
        .toUpperCase();
    final admin = (place['admin1'] as String?)?.trim();

    if (country != null && country.isNotEmpty) return country;
    if (countryCode != null && _countryNamesByCode.containsKey(countryCode))
      return _countryNamesByCode[countryCode]!;
    if (admin != null && admin.isNotEmpty) return admin;
    return 'Nazione non disponibile';
  }

  String _getPlaceLabel(Map<String, dynamic> place, String country) {
    final name = place['name'] as String? ?? '';
    final admin = (place['admin1'] as String?)?.trim();
    final showAdmin =
        admin != null &&
        admin.isNotEmpty &&
        _normalizeText(admin) != _normalizeText(name) &&
        _normalizeText(admin) != _normalizeText(country);
    return showAdmin ? '$name, $admin, $country' : '$name, $country';
  }

  String? _getEventTime(Map<String, dynamic> response, String key) {
    final properties = response['properties'] as Map<String, dynamic>?;
    final value = properties?[key];
    if (value is Map<String, dynamic>) return value['time'] as String?;
    return null;
  }

  Map<String, dynamic>? _findBestPlace(
    String query,
    List<Map<String, dynamic>> places,
  ) {
    final acceptedNames = _getAcceptedNames(query);
    for (final place in places) {
      final normalizedName = _normalizeText(place['name'] as String? ?? '');
      final accepted = acceptedNames.any(
        (name) => normalizedName == name || normalizedName.startsWith('$name '),
      );
      if (accepted) return place;
    }
    return null;
  }

  List<String> _getAcceptedNames(String query) {
    final normalized = _normalizeText(query);
    return [normalized, ...(_cityAliases[normalized] ?? [])];
  }

  String _getSearchName(String query) => query.split(',').first.trim();

  String _normalizeText(String value) {
    const accents = {
      '\u00e0': 'a',
      '\u00e1': 'a',
      '\u00e8': 'e',
      '\u00e9': 'e',
      '\u00ec': 'i',
      '\u00ed': 'i',
      '\u00f2': 'o',
      '\u00f3': 'o',
      '\u00f9': 'u',
      '\u00fa': 'u',
    };
    final buffer = StringBuffer();
    for (final codeUnit in value.toLowerCase().trim().codeUnits) {
      final char = String.fromCharCode(codeUnit);
      buffer.write(accents[char] ?? char);
    }
    return buffer.toString();
  }

  DateTime _getLocalNow(int offsetSeconds) =>
      _now().toUtc().add(Duration(seconds: offsetSeconds));

  bool _isDaylight(String localIso, String? sunrise, String? sunset) {
    if (sunrise == null || sunset == null) return false;
    return localIso.compareTo(_normalizeEventIso(sunrise)) >= 0 &&
        localIso.compareTo(_normalizeEventIso(sunset)) < 0;
  }

  String _formatCurrentDateTime(int offsetSeconds) {
    final date = _getLocalNow(offsetSeconds);
    return '${_two(date.day)} ${_months[date.month - 1]} ${date.year}, ${_two(date.hour)}:${_two(date.minute)}:${_two(date.second)}';
  }

  String _formatApiDateTime(String localDateTime) {
    if (!localDateTime.contains('T')) return 'Non disponibile';
    final parts = localDateTime.split('T');
    final date = parts[0].split('-').map(int.tryParse).toList();
    final time = parts[1].split(':');
    if (date.length < 3 || date.any((value) => value == null))
      return 'Non disponibile';
    return '${date[2]} ${_months[(date[1] ?? 1) - 1]} ${date[0]}, alle ${time[0]}:${time.length > 1 ? time[1] : '00'}';
  }

  String _formatEventTime(String? value, String referenceDate) {
    if (value == null) return 'Non disponibile';
    final eventIso = _normalizeEventIso(value);
    if (!eventIso.contains('T')) return 'Non disponibile';
    final parts = eventIso.split('T');
    final time = parts[1].split(':');
    final label = '${time[0]}:${time.length > 1 ? time[1] : '00'}';
    if (parts[0] == referenceDate) return label;
    final date = parts[0].split('-').map(int.tryParse).toList();
    if (date.length < 3 || date.any((value) => value == null)) return label;
    return '${date[2]} ${_months[(date[1] ?? 1) - 1]} ${date[0]}, $label';
  }

  String _normalizeEventIso(String value) =>
      value.replaceFirst(RegExp(r'([+-]\d{2}:\d{2}|Z)$'), '');

  int _getEffectiveWeatherCode(int code, int cloudCover) {
    if (![0, 1, 2, 3].contains(code)) return code;
    if (cloudCover <= 15) return 0;
    if (cloudCover <= 65) return 2;
    return 3;
  }

  String _getWeatherDescription(int code) {
    if (code == 0) return 'Sereno';
    if ([1, 2].contains(code)) return 'Parzialmente nuvoloso';
    if (code == 3) return 'Nuvoloso';
    if ([45, 48].contains(code)) return 'Nebbia';
    if ([51, 53, 55, 56, 57].contains(code)) return 'Pioviggine';
    if ([61, 63, 65, 66, 67, 80, 81, 82].contains(code)) return 'Pioggia';
    if ([71, 73, 75, 77, 85, 86].contains(code)) return 'Neve';
    if ([95, 96, 99].contains(code)) return 'Temporale';
    return 'Condizioni variabili';
  }

  String _getWeatherIconUrl(int code, bool isDaylight) {
    final moment = isDaylight ? 'day' : 'night';
    var iconCode = 113;
    if ([1, 2].contains(code)) iconCode = 116;
    if (code == 3) iconCode = 122;
    if ([45, 48].contains(code)) iconCode = 248;
    if ([51, 53, 55, 56, 57].contains(code)) iconCode = 266;
    if ([61, 63, 65, 66, 67, 80, 81, 82].contains(code)) iconCode = 302;
    if ([71, 73, 75, 77, 85, 86].contains(code)) iconCode = 338;
    if ([95, 96, 99].contains(code)) iconCode = 389;
    return 'assets/weather_icons/$moment/$iconCode.png';
  }

  WeatherTheme _getWeatherTheme(
    int code,
    int cloudCover,
    bool isDaylight,
    String localIso,
    String? sunrise,
    String? sunset,
  ) {
    if ([95, 96, 99].contains(code)) return WeatherTheme.stormy;
    if ([71, 73, 75, 77, 85, 86].contains(code)) return WeatherTheme.snowy;
    if ([61, 63, 65, 66, 67, 80, 81, 82, 51, 53, 55, 56, 57].contains(code))
      return WeatherTheme.rainy;
    if ([45, 48].contains(code)) return WeatherTheme.foggy;
    if (_isNearSunrise(localIso, sunrise)) return WeatherTheme.sunrise;
    if (_isNearSunset(localIso, sunset))
      return _isAfterSunset(localIso, sunset)
          ? WeatherTheme.sunsetGlow
          : WeatherTheme.sunset;
    if (!isDaylight) {
      if ([1, 2].contains(code) || (cloudCover > 15 && cloudCover <= 65))
        return WeatherTheme.partlyCloudyNight;
      if (code == 3 || cloudCover > 65) return WeatherTheme.cloudyNight;
      return WeatherTheme.night;
    }
    if ([1, 2].contains(code)) return WeatherTheme.partlyCloudy;
    if (code == 3) return WeatherTheme.cloudy;
    if (code == 0) return WeatherTheme.sunny;
    return WeatherTheme.standard;
  }

  bool _isNearSunrise(String localIso, String? sunrise) {
    if (sunrise == null) return false;
    final value = _normalizeEventIso(sunrise);
    return localIso.compareTo(_addMinutes(value, -30)) >= 0 &&
        localIso.compareTo(_addMinutes(value, 60)) < 0;
  }

  bool _isNearSunset(String localIso, String? sunset) {
    if (sunset == null) return false;
    final value = _normalizeEventIso(sunset);
    return localIso.compareTo(_addMinutes(value, -60)) >= 0 &&
        localIso.compareTo(_addMinutes(value, 30)) < 0;
  }

  bool _isAfterSunset(String localIso, String? sunset) =>
      sunset != null && localIso.compareTo(_normalizeEventIso(sunset)) >= 0;

  bool _isNightTheme(WeatherTheme theme) {
    return theme == WeatherTheme.night ||
        theme == WeatherTheme.partlyCloudyNight ||
        theme == WeatherTheme.cloudyNight;
  }

  String _addMinutes(String localIso, int minutes) =>
      _toLocalIso(DateTime.parse(localIso).add(Duration(minutes: minutes)));
  String _addDaysToDate(String date, int days) =>
      _formatDate(DateTime.parse(date).add(Duration(days: days)));
  String _formatDate(DateTime date) =>
      '${date.year}-${_two(date.month)}-${_two(date.day)}';
  String _toLocalIso(DateTime date) =>
      '${date.year}-${_two(date.month)}-${_two(date.day)}T${_two(date.hour)}:${_two(date.minute)}:${_two(date.second)}';

  String _formatOffset(int offsetSeconds) {
    final sign = offsetSeconds >= 0 ? '+' : '-';
    final value = offsetSeconds.abs();
    final hours = value ~/ 3600;
    final minutes = (value % 3600) ~/ 60;
    return '$sign${_two(hours)}:${_two(minutes)}';
  }

  String _formatCoordinate(Object? value) {
    final coordinate = (value as num?)?.toDouble();
    if (coordinate == null) throw const WeatherServiceException();
    return coordinate.toStringAsFixed(4);
  }

  double _progress(String currentIso, String startIso, String endIso) {
    final start = DateTime.parse(startIso).millisecondsSinceEpoch;
    final end = DateTime.parse(endIso).millisecondsSinceEpoch;
    final current = DateTime.parse(currentIso).millisecondsSinceEpoch;
    return ((current - start) / (end - start)).clamp(0, 1).toDouble();
  }

  double _lerp(double start, double end, double progress) =>
      start + (end - start) * progress;
  double _easeIn(double progress) => progress * progress;
  double _easeOut(double progress) => 1 - pow(1 - progress, 2).toDouble();
  String _two(int value) => value.toString().padLeft(2, '0');
}
