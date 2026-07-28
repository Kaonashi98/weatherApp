enum WeatherTheme {
  standard,
  sunny,
  partlyCloudy,
  partlyCloudyNight,
  cloudy,
  cloudyNight,
  rainy,
  snowy,
  stormy,
  foggy,
  sunrise,
  sunset,
  sunsetGlow,
  night,
}

class CitySuggestion {
  const CitySuggestion({
    required this.id,
    required this.name,
    required this.country,
    required this.latitude,
    required this.longitude,
    required this.label,
    this.admin1,
  });

  final String id;
  final String name;
  final String country;
  final String? admin1;
  final double latitude;
  final double longitude;
  final String label;
}

class WeatherViewModel {
  const WeatherViewModel({
    required this.city,
    required this.country,
    required this.temperature,
    required this.windSpeed,
    required this.humidity,
    required this.cloudCover,
    required this.description,
    required this.iconUrl,
    required this.theme,
    required this.weatherCode,
    required this.utcOffsetSeconds,
    required this.isDaylight,
    required this.sunRise,
    required this.sunSet,
    required this.moonRise,
    required this.moonSet,
    required this.sunRiseLabel,
    required this.sunSetLabel,
    required this.moonRiseLabel,
    required this.moonSetLabel,
    required this.localDateTime,
    required this.updatedAtLabel,
  });

  final String city;
  final String country;
  final int temperature;
  final int windSpeed;
  final int humidity;
  final int cloudCover;
  final String description;
  final String iconUrl;
  final WeatherTheme theme;
  final int weatherCode;
  final int utcOffsetSeconds;
  final bool isDaylight;
  final String? sunRise;
  final String? sunSet;
  final String? moonRise;
  final String? moonSet;
  final String sunRiseLabel;
  final String sunSetLabel;
  final String moonRiseLabel;
  final String moonSetLabel;
  final String localDateTime;
  final String updatedAtLabel;

  WeatherViewModel copyWith({
    String? iconUrl,
    WeatherTheme? theme,
    String? localDateTime,
    bool? isDaylight,
  }) {
    return WeatherViewModel(
      city: city,
      country: country,
      temperature: temperature,
      windSpeed: windSpeed,
      humidity: humidity,
      cloudCover: cloudCover,
      description: description,
      iconUrl: iconUrl ?? this.iconUrl,
      theme: theme ?? this.theme,
      weatherCode: weatherCode,
      utcOffsetSeconds: utcOffsetSeconds,
      isDaylight: isDaylight ?? this.isDaylight,
      sunRise: sunRise,
      sunSet: sunSet,
      moonRise: moonRise,
      moonSet: moonSet,
      sunRiseLabel: sunRiseLabel,
      sunSetLabel: sunSetLabel,
      moonRiseLabel: moonRiseLabel,
      moonSetLabel: moonSetLabel,
      localDateTime: localDateTime ?? this.localDateTime,
      updatedAtLabel: updatedAtLabel,
    );
  }
}
