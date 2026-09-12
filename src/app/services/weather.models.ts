export type WeatherTheme =
  | 'default'
  | 'sunny'
  | 'partly-cloudy'
  | 'partly-cloudy-night'
  | 'cloudy'
  | 'cloudy-night'
  | 'rainy'
  | 'snowy'
  | 'stormy'
  | 'foggy'
  | 'sunrise'
  | 'sunset'
  | 'sunset-glow'
  | 'night';

export type CitySuggestion = {
  id: string;
  name: string;
  country: string;
  admin1?: string;
  admin2?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  label: string;
};

export type HourlyForecast = {
  time: string;
  timeLabel: string;
  dateLabel: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitationProbability: number;
  precipitation: number;
  windSpeed: number;
  windGusts: number;
  weatherCode: number;
  description: string;
  iconUrl: string;
};

export type DailyPeriodForecast = {
  label: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitationProbability: number;
  windSpeed: number;
  description: string;
  iconUrl: string;
};

export type DailyForecast = {
  date: string;
  dateLabel: string;
  shortDateLabel: string;
  weatherCode: number;
  description: string;
  iconUrl: string;
  temperatureMax: number;
  temperatureMin: number;
  apparentTemperatureMax: number;
  apparentTemperatureMin: number;
  precipitationProbability: number;
  precipitationSum: number;
  rainSum: number;
  showersSum: number;
  snowfallSum: number;
  windSpeedMax: number;
  windGustsMax: number;
  uvIndexMax: number;
  sunriseLabel: string;
  sunsetLabel: string;
  moonriseLabel: string;
  moonsetLabel: string;
  morning: DailyPeriodForecast | null;
  evening: DailyPeriodForecast | null;
  hours: HourlyForecast[];
};

export type WeatherViewModel = {
  city: string;
  country: string;
  admin1?: string;
  admin2?: string;
  countryCode?: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  temperature: number;
  windSpeed: number;
  humidity: number;
  cloudCover: number;
  description: string;
  iconUrl: string;
  theme: WeatherTheme;
  weatherCode: number;
  timeZone: string;
  isDaylight: boolean;
  sunRise: string | null;
  sunSet: string | null;
  moonRise: string | null;
  moonSet: string | null;
  sunRiseLabel: string;
  sunSetLabel: string;
  moonRiseLabel: string;
  moonSetLabel: string;
  localDateTime: string;
  updatedAtLabel: string;
  updatedAt: number;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
};

export type OpenMeteoPlace = {
  id?: number;
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  latitude: number;
  longitude: number;
};
