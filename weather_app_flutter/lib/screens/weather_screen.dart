import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../models/weather_models.dart';
import '../services/weather_service.dart';
import '../widgets/weather_scene.dart';

class WeatherScreen extends StatefulWidget {
  const WeatherScreen({super.key});

  @override
  State<WeatherScreen> createState() => _WeatherScreenState();
}

class _WeatherScreenState extends State<WeatherScreen> {
  final WeatherService _weatherService = WeatherService();
  final TextEditingController _cityController = TextEditingController();
  final FocusNode _cityFocusNode = FocusNode();

  final List<String> _quickCities = const [
    'Roma',
    'Milano',
    'Londra',
    'Parigi',
    'Madrid',
    'Berlino',
    'Amsterdam',
    'Bruxelles',
    'Vienna',
    'Praga',
    'Atene',
    'Lisbona',
    'Dublino',
    'Oslo',
    'Stoccolma',
    'Copenaghen',
    'Helsinki',
    'Varsavia',
    'Zurigo',
    'New York',
    'Los Angeles',
    'Toronto',
    'Citt\u00e0 del Messico',
    'Buenos Aires',
    'Rio de Janeiro',
    'Tokyo',
    'Seoul',
    'Pechino',
    'Shanghai',
    'Hong Kong',
    'Singapore',
  ];

  WeatherViewModel? _weather;
  List<CitySuggestion> _suggestions = [];
  CitySuggestion? _selectedSuggestion;
  Timer? _suggestionTimer;
  Timer? _clockTimer;
  bool _isLoading = false;
  bool _isSuggesting = false;
  bool _showSuggestions = false;
  bool _isWeatherPanelOpen = false;
  String _errorMessage = '';
  int _weatherRequestId = 0;

  @override
  void dispose() {
    _cityController.dispose();
    _cityFocusNode.dispose();
    _suggestionTimer?.cancel();
    _clockTimer?.cancel();
    _weatherService.dispose();
    super.dispose();
  }

  Future<void> _getWeather() async {
    final city = _cityController.text.trim();

    if (city.isEmpty) {
      _showValidation('Inserisci il nome di una citt\u00e0.');
      return;
    }

    if (city.length < 4) {
      _showValidation(
        'Scrivi almeno 4 lettere, cos\u00ec evitiamo risultati casuali.',
      );
      return;
    }

    _suggestionTimer?.cancel();
    final requestId = ++_weatherRequestId;
    setState(() {
      _isLoading = true;
      _isSuggesting = false;
      _showSuggestions = false;
      _isWeatherPanelOpen = true;
      _errorMessage = '';
    });

    try {
      final selected = _selectedSuggestion?.label == city
          ? _selectedSuggestion
          : null;
      final data = selected == null
          ? await _weatherService.getWeather(city)
          : await _weatherService.getWeatherForSuggestion(selected);
      if (!mounted || requestId != _weatherRequestId) return;
      setState(() {
        _weather = data;
        _isLoading = false;
        _isWeatherPanelOpen = true;
      });
      _startClock();
    } catch (error) {
      if (!mounted || requestId != _weatherRequestId) return;
      final message = error is WeatherConnectionException
          ? 'Nessuna connessione. Collega il dispositivo a Internet per consultare il meteo.'
          : error is WeatherServiceException
          ? 'Il servizio meteo non \u00e8 disponibile. Riprova tra poco.'
          : 'Citt\u00e0 non trovata. Controlla il nome oppure prova con un nome pi\u00f9 specifico.';
      if (error is WeatherConnectionException) {
        _resetSearchPanel(errorMessage: message);
        return;
      }

      setState(() {
        _weather = null;
        _isLoading = false;
        _isWeatherPanelOpen = false;
        _errorMessage = message;
      });
      _clockTimer?.cancel();
    }
  }

  void _showValidation(String message) {
    setState(() {
      _suggestions = [];
      _showSuggestions = false;
      _isSuggesting = false;
      _weather = null;
      _isWeatherPanelOpen = false;
      _errorMessage = message;
    });
    _clockTimer?.cancel();
  }

  void _onCityChanged(String value) {
    _weatherRequestId++;
    _selectedSuggestion = null;
    setState(() {
      _errorMessage = '';
      _weather = null;
      _isWeatherPanelOpen = false;
    });
    _queueSuggestions(value);
  }

  void _queueSuggestions(String value) {
    _suggestionTimer?.cancel();
    final query = value.trim();

    if (query.length < 2) {
      setState(() {
        _suggestions = [];
        _isSuggesting = false;
        _showSuggestions = false;
      });
      return;
    }

    setState(() {
      _isSuggesting = true;
      _showSuggestions = true;
    });

    _suggestionTimer = Timer(const Duration(milliseconds: 260), () async {
      try {
        final suggestions = await _weatherService.searchCities(query);
        if (!mounted) return;
        if (_normalize(_cityController.text) == _normalize(query)) {
          setState(() {
            _suggestions = suggestions;
            _showSuggestions = suggestions.isNotEmpty;
            _isSuggesting = false;
          });
        }
      } catch (error) {
        if (!mounted || _normalize(_cityController.text) != _normalize(query)) {
          return;
        }
        if (error is WeatherConnectionException) {
          _resetSearchPanel(
            errorMessage:
                'Nessuna connessione. Collega il dispositivo a Internet per consultare il meteo.',
          );
          return;
        }
        setState(() {
          _suggestions = [];
          _showSuggestions = false;
          _isSuggesting = false;
        });
      }
    });
  }

  void _selectSuggestion(CitySuggestion suggestion) {
    _selectedSuggestion = suggestion;
    _cityController.text = suggestion.label;
    setState(() {
      _suggestions = [];
      _showSuggestions = false;
      _isSuggesting = false;
      _errorMessage = '';
    });
    _getWeather();
  }

  void _quickSearch(String city) {
    _selectedSuggestion = null;
    _cityController.text = city;
    setState(() {
      _suggestions = [];
      _showSuggestions = false;
      _isSuggesting = false;
      _errorMessage = '';
    });
    _getWeather();
  }

  void _showSearchPanel() {
    _resetSearchPanel();
  }

  void _resetSearchPanel({String errorMessage = ''}) {
    _weatherRequestId++;
    _suggestionTimer?.cancel();
    _clockTimer?.cancel();
    _cityController.clear();
    setState(() {
      _weather = null;
      _isWeatherPanelOpen = false;
      _isLoading = false;
      _isSuggesting = false;
      _showSuggestions = false;
      _suggestions = [];
      _selectedSuggestion = null;
      _errorMessage = errorMessage;
    });
  }

  void _startClock() {
    _clockTimer?.cancel();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _weather == null) return;
      setState(() => _weather = _weatherService.refreshLiveFields(_weather!));
    });
  }

  Future<void> _showLegalInformation() {
    return showDialog<void>(
      context: context,
      builder: (context) => Dialog(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 680, maxHeight: 720),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Privacy, fonti e licenze',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Chiudi',
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const _LegalSection(
                  title: 'Sviluppatore e contatti',
                  body:
                      'WeatherApp è sviluppata da Nicola Zingaro. L’app è gratuita, senza pubblicità e senza acquisti in-app. Assistenza e privacy: weatherapp.help@outlook.com. Sito: weather-app-blond-six-70.vercel.app.',
                ),
                const _LegalSection(
                  title: 'Dati trattati',
                  body:
                      'WeatherApp non richiede account e non usa sistemi di tracciamento. Il nome della località viene inviato a Open-Meteo; coordinate e dati tecnici vengono trasmessi a Open-Meteo e MET Norway. Le icone WeatherAPI.com sono incluse nell’app e non generano richieste al servizio durante l’uso. L’app non salva permanentemente le ricerche.',
                ),
                const _LegalSection(
                  title: 'Fonti e licenze',
                  body:
                      'Meteo e geocodifica: Open-Meteo, con dati di località basati su GeoNames. Eventi di sole e luna: MET Norway. Icone meteo: WeatherAPI.com. Logo e immagini atmosferiche locali sono utilizzati con autorizzazione del proprietario.',
                ),
                const SelectableText(
                  'weatherapp.help@outlook.com\nweather-app-blond-six-70.vercel.app/privacy.html\nopen-meteo.com\ndocs.api.met.no/doc/License.html\nweatherapi.com\ngeonames.org',
                  style: TextStyle(
                    color: Color(0xFF1D4ED8),
                    fontWeight: FontWeight.w700,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Le informazioni meteorologiche sono indicative e non devono essere usate per decisioni di sicurezza o emergenza.',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final weather = _weather;
    final sceneTheme = weather?.theme ?? WeatherTheme.standard;
    final orbTop = weather == null
        ? 0.07
        : _weatherService.solarOrbTop(weather);

    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          Positioned.fill(
            child: WeatherScene(theme: sceneTheme, orbTop: orbTop),
          ),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, viewport) {
                if (viewport.maxWidth <= 0 || viewport.maxHeight <= 0) {
                  return const ColoredBox(color: Colors.white);
                }

                final isDesktop = viewport.maxWidth > 1040;
                final isTablet =
                    viewport.maxWidth > 620 && viewport.maxWidth <= 1040;
                final isMobile = !isDesktop && !isTablet;
                final isMobileOverlay = isMobile && _isWeatherPanelOpen;
                final shellWidth = isDesktop ? 1240.0 : 780.0;
                final availableWidth = math.max(1.0, viewport.maxWidth - 20);
                final shellHeight = isDesktop
                    ? math.max(1.0, math.min(780.0, viewport.maxHeight - 28))
                    : isTablet
                    ? null
                    : math.max(1.0, viewport.maxHeight - 20);

                return SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: viewport.maxHeight),
                    child: Center(
                      child: Container(
                        width: math.min(shellWidth, availableWidth),
                        height: shellHeight,
                        margin: EdgeInsets.symmetric(
                          vertical: isDesktop ? 14 : 10,
                        ),
                        padding: EdgeInsets.all(
                          isDesktop
                              ? 24
                              : isMobileOverlay
                              ? 0
                              : 12,
                        ),
                        clipBehavior: Clip.antiAlias,
                        decoration: _shellDecoration(
                          radius: isDesktop ? 28 : 22,
                        ),
                        child: Column(
                          mainAxisSize: shellHeight == null
                              ? MainAxisSize.min
                              : MainAxisSize.max,
                          children: [
                            if (!isMobileOverlay) ...[
                              SizedBox(
                                height: isDesktop ? 108 : 66,
                                child: Center(
                                  child: Image.asset(
                                    'assets/images/weatherapp-logo-cropped.png',
                                    width: isDesktop ? 520 : 330,
                                    fit: BoxFit.contain,
                                  ),
                                ),
                              ),
                              SizedBox(height: isDesktop ? 18 : 10),
                            ],
                            ExpandedOrIntrinsic(
                              expanded: shellHeight != null,
                              child: isDesktop
                                  ? Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        Expanded(
                                          flex: 82,
                                          child: _searchPanel(),
                                        ),
                                        const SizedBox(width: 18),
                                        Expanded(
                                          flex: 118,
                                          child: _weatherPanel(
                                            isDesktop: true,
                                            isOverlay: false,
                                          ),
                                        ),
                                      ],
                                    )
                                  : _mobileOrTabletContent(isTablet: isTablet),
                            ),
                            if (!isMobileOverlay) ...[
                              const SizedBox(height: 4),
                              TextButton.icon(
                                onPressed: _showLegalInformation,
                                icon: const Icon(
                                  Icons.privacy_tip_outlined,
                                  size: 18,
                                ),
                                label: const Text('Privacy e fonti'),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _mobileOrTabletContent({required bool isTablet}) {
    if (isTablet) {
      return Column(
        children: [
          _searchPanel(),
          const SizedBox(height: 14),
          _weatherPanel(isDesktop: false, isOverlay: false),
        ],
      );
    }

    return Stack(
      children: [
        AnimatedOpacity(
          opacity: _isWeatherPanelOpen ? 0 : 1,
          duration: const Duration(milliseconds: 240),
          child: IgnorePointer(
            ignoring: _isWeatherPanelOpen,
            child: _searchPanel(),
          ),
        ),
        if (_isWeatherPanelOpen)
          Positioned.fill(
            child: _weatherPanel(isDesktop: false, isOverlay: true),
          ),
      ],
    );
  }

  Widget _searchPanel() {
    final isMobile = MediaQuery.sizeOf(context).width <= 620;

    return _Panel(
      compact: isMobile,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Kicker('Ricerca'),
          const SizedBox(height: 8),
          Text(
            'Controlla il meteo attuale della tua citt\u00e0',
            style: TextStyle(
              fontSize: isMobile ? 28 : 34,
              height: .98,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF101828),
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'Temperatura, vento, umidit\u00e0 e condizioni attuali in pochi secondi.',
            style: TextStyle(
              fontSize: 16,
              height: 1.46,
              color: Color(0xFF667085),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 14),
          _searchBox(),
          if (_errorMessage.isNotEmpty) ...[
            const SizedBox(height: 12),
            _Notice(message: _errorMessage),
          ],
          const SizedBox(height: 16),
          FlexibleOrIntrinsic(
            child: SingleChildScrollView(
              child: Wrap(
                spacing: _errorMessage.isNotEmpty ? 6 : 7,
                runSpacing: _errorMessage.isNotEmpty ? 6 : 7,
                children: _quickCities.map((city) {
                  final selected =
                      _normalize(_cityController.text.split(',').first) ==
                      _normalize(city);
                  return ChoiceChip(
                    label: Text(city),
                    selected: selected,
                    onSelected: (_) => _quickSearch(city),
                    labelStyle: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: selected
                          ? const Color(0xFF0F172A)
                          : const Color(0xFF1D4ED8),
                    ),
                    selectedColor: const Color(0xFFDBEAFE),
                    backgroundColor: const Color(0xFFE0ECFF),
                    side: selected
                        ? const BorderSide(color: Color(0xFF0F172A), width: 2)
                        : BorderSide.none,
                    shape: const StadiumBorder(),
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  );
                }).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _searchBox() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _Kicker('Citt\u00e0'),
        const SizedBox(height: 7),
        LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 430;
            final controlHeight = compact ? 46.0 : 50.0;
            final input = _cityInput(height: controlHeight);
            final button = SizedBox(
              height: controlHeight,
              width: compact ? double.infinity : 116,
              child: FilledButton(
                onPressed: _isLoading ? null : _getWeather,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  disabledBackgroundColor: const Color(0xFF7BA2F3),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: Text(
                  _isLoading ? 'Attendi...' : 'Cerca',
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            );

            final showSuggestions =
                _showSuggestions && (_isSuggesting || _suggestions.isNotEmpty);
            final actionArea = AnimatedSwitcher(
              duration: const Duration(milliseconds: 160),
              child: showSuggestions ? _suggestionsBox() : button,
            );

            if (compact) {
              return Column(
                children: [input, const SizedBox(height: 10), actionArea],
              );
            }

            if (showSuggestions) {
              return Column(
                children: [input, const SizedBox(height: 10), actionArea],
              );
            }

            return Row(
              children: [
                Expanded(child: input),
                const SizedBox(width: 10),
                button,
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _cityInput({required double height}) {
    return SizedBox(
      height: height,
      child: TextField(
        controller: _cityController,
        focusNode: _cityFocusNode,
        textInputAction: TextInputAction.search,
        onChanged: _onCityChanged,
        onSubmitted: (_) => _getWeather(),
        onTap: () {
          if (_suggestions.isNotEmpty || _isSuggesting) {
            setState(() => _showSuggestions = true);
          }
        },
        decoration: InputDecoration(
          hintText: 'Roma, Milano, New York',
          filled: true,
          fillColor: Colors.white.withValues(alpha: .88),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0x1F0F172A)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0x1F0F172A)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xAA2563EB)),
          ),
        ),
      ),
    );
  }

  Widget _suggestionsBox() {
    return Container(
      key: const ValueKey('suggestions'),
      width: double.infinity,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .90),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x292563EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .10),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: _isSuggesting
          ? const Padding(
              padding: EdgeInsets.all(10),
              child: Text(
                'Ricerca localit\u00e0...',
                style: TextStyle(
                  color: Color(0xFF667085),
                  fontWeight: FontWeight.w900,
                ),
              ),
            )
          : Column(
              children: _suggestions.map((suggestion) {
                final meta =
                    suggestion.admin1 != null &&
                        suggestion.label.contains(', ${suggestion.admin1},')
                    ? '${suggestion.admin1}, ${suggestion.country}'
                    : suggestion.country;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Material(
                    color: const Color(0xB3EFF6FF),
                    borderRadius: BorderRadius.circular(13),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(13),
                      onTap: () => _selectSuggestion(suggestion),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                suggestion.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Flexible(
                              child: Text(
                                meta,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF667085),
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
    );
  }

  Widget _weatherPanel({required bool isDesktop, required bool isOverlay}) {
    return _WeatherPanelShell(
      isOverlay: isOverlay,
      onBack: isOverlay ? _showSearchPanel : null,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 260),
        child: _isLoading
            ? const _LoadingWeather(key: ValueKey('loading'))
            : _weather == null
            ? const _EmptyWeather(key: ValueKey('empty'))
            : _WeatherCard(
                key: const ValueKey('weather'),
                weather: _weather!,
                isDesktop: isDesktop,
              ),
      ),
    );
  }

  BoxDecoration _shellDecoration({required double radius}) {
    return BoxDecoration(
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: Colors.white.withValues(alpha: .36)),
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Colors.white.withValues(alpha: .86),
          Colors.white.withValues(alpha: .62),
        ],
      ),
      boxShadow: [
        BoxShadow(
          color: const Color(0xFF0F172A).withValues(alpha: .24),
          blurRadius: 80,
          offset: const Offset(0, 28),
        ),
      ],
    );
  }

  String _normalize(String value) {
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
}

class _WeatherCard extends StatelessWidget {
  const _WeatherCard({
    super.key,
    required this.weather,
    required this.isDesktop,
  });

  final WeatherViewModel weather;
  final bool isDesktop;

  @override
  Widget build(BuildContext context) {
    final isMobile = !isDesktop;
    final conditionBadge = Container(
      constraints: const BoxConstraints(minHeight: 34),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFE0F2FE),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: .55)),
      ),
      child: Text(
        weather.description,
        style: const TextStyle(
          fontWeight: FontWeight.w900,
          color: Color(0xFF075985),
          fontSize: 13,
        ),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _Kicker('Localit\u00e0'),
                  const SizedBox(height: 6),
                  Text(
                    '${weather.city}, ${weather.country}',
                    style: TextStyle(
                      fontSize: isDesktop ? 39 : 24,
                      height: 1.04,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF101828),
                    ),
                  ),
                ],
              ),
            ),
            if (isDesktop) ...[const SizedBox(width: 18), conditionBadge],
          ],
        ),
        if (isMobile) ...[
          const SizedBox(height: 10),
          Align(alignment: Alignment.centerLeft, child: conditionBadge),
        ],
        SizedBox(height: isDesktop ? 18 : 12),
        _TemperatureSummary(weather: weather, isDesktop: isDesktop),
        SizedBox(height: isDesktop ? 14 : 10),
        _DetailsList(weather: weather, isMobile: isMobile),
      ],
    );
  }
}

class _TemperatureSummary extends StatelessWidget {
  const _TemperatureSummary({required this.weather, required this.isDesktop});

  final WeatherViewModel weather;
  final bool isDesktop;

  @override
  Widget build(BuildContext context) {
    final content = Row(
      children: [
        Expanded(
          child: RichText(
            text: TextSpan(
              text: '${weather.temperature}',
              style: TextStyle(
                fontSize: isDesktop ? 122 : 58,
                height: .86,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF101828),
              ),
              children: [
                TextSpan(
                  text: '\u00b0C',
                  style: TextStyle(
                    fontSize: isDesktop ? 32 : 22,
                    color: const Color(0xFF667085),
                  ),
                ),
              ],
            ),
          ),
        ),
        Container(
          width: isDesktop ? 132 : 96,
          height: isDesktop ? 132 : 96,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(isDesktop ? 34 : 24),
            border: Border.all(color: Colors.white.withValues(alpha: .64)),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Colors.white, Color(0xFFDBEAFE)],
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF2563EB).withValues(alpha: .14),
                blurRadius: 36,
                offset: const Offset(0, 14),
              ),
            ],
          ),
          child: Semantics(
            label: weather.description,
            image: true,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(isDesktop ? 34 : 24),
              child: Image.asset(
                weather.iconUrl,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    const Icon(Icons.cloud, size: 62, color: Color(0xFF2563EB)),
              ),
            ),
          ),
        ),
      ],
    );

    if (isDesktop) return content;

    return Container(
      constraints: const BoxConstraints(minHeight: 112),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .56),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x140F172A)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2563EB).withValues(alpha: .06),
            blurRadius: 26,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: content,
    );
  }
}

class _DetailsList extends StatelessWidget {
  const _DetailsList({required this.weather, required this.isMobile});

  final WeatherViewModel weather;
  final bool isMobile;

  @override
  Widget build(BuildContext context) {
    final detailTiles = [
      _DetailTile(
        label: 'Umidit\u00e0',
        value: '${weather.humidity}%',
        compact: isMobile,
      ),
      _DetailTile(
        label: 'Vento',
        value: '${weather.windSpeed} km/h',
        compact: isMobile,
      ),
      _DetailTile(
        label: 'Ora locale',
        value: weather.localDateTime,
        compact: isMobile,
        smallValue: true,
      ),
      _DetailTile(
        label: 'Alba sole',
        value: weather.sunRiseLabel,
        compact: isMobile,
      ),
      _DetailTile(
        label: 'Tramonto sole',
        value: weather.sunSetLabel,
        compact: isMobile,
      ),
      _DetailTile(
        label: 'Alba luna',
        value: weather.moonRiseLabel,
        compact: isMobile,
      ),
      _DetailTile(
        label: 'Tramonto luna',
        value: weather.moonSetLabel,
        compact: isMobile,
      ),
      _DetailTile(
        label: 'Meteo aggiornato',
        value: weather.updatedAtLabel,
        compact: isMobile,
        smallValue: true,
        centered: isMobile,
      ),
    ];

    if (isMobile) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var index = 0; index < detailTiles.length; index++) ...[
            detailTiles[index],
            if (index < detailTiles.length - 1) const SizedBox(height: 10),
          ],
        ],
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 680 ? 4 : 2;
        return GridView.count(
          crossAxisCount: columns,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: columns == 2 ? 2.25 : 1.48,
          children: detailTiles,
        );
      },
    );
  }
}

class _LegalSection extends StatelessWidget {
  const _LegalSection({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 5),
          Text(body, style: const TextStyle(height: 1.45)),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child, this.compact = false});

  final Widget child;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(minHeight: 0),
      padding: EdgeInsets.all(compact ? 18 : 24),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .84),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: .52)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: .14),
            blurRadius: 50,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _WeatherPanelShell extends StatelessWidget {
  const _WeatherPanelShell({
    required this.child,
    required this.isOverlay,
    this.onBack,
  });

  final Widget child;
  final bool isOverlay;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: isOverlay ? double.infinity : null,
      padding: EdgeInsets.all(isOverlay ? 18 : 24),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(isOverlay ? 22 : 24),
        border: Border.all(
          color: Colors.white.withValues(alpha: isOverlay ? .86 : .52),
        ),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xF0FFFFFF), Color(0xD9ECFDF5)],
        ),
        boxShadow: isOverlay
            ? []
            : [
                BoxShadow(
                  color: const Color(0xFF0F172A).withValues(alpha: .14),
                  blurRadius: 50,
                  offset: const Offset(0, 18),
                ),
              ],
      ),
      child: isOverlay
          ? Stack(
              fit: StackFit.expand,
              children: [
                Positioned.fill(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.only(top: 52),
                    child: child,
                  ),
                ),
                Positioned(
                  top: 0,
                  right: 0,
                  child: _BackToSearchButton(onPressed: onBack!),
                ),
              ],
            )
          : SingleChildScrollView(child: child),
    );
  }
}

class _BackToSearchButton extends StatelessWidget {
  const _BackToSearchButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 38,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: const Icon(Icons.arrow_back, size: 16),
        label: const Text('Cambia citt\u00e0'),
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFF0F172A),
          backgroundColor: Colors.white.withValues(alpha: .96),
          side: const BorderSide(color: Color(0x1A0F172A)),
          shape: const StadiumBorder(),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          textStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
        ),
      ),
    );
  }
}

class _Kicker extends StatelessWidget {
  const _Kicker(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w900,
        letterSpacing: 1.2,
        color: Color(0xFF475467),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(minHeight: 40),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Text(
        message,
        style: const TextStyle(
          color: Color(0xFF991B1B),
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _DetailTile extends StatelessWidget {
  const _DetailTile({
    required this.label,
    required this.value,
    this.compact = false,
    this.smallValue = false,
    this.centered = false,
  });

  final String label;
  final String value;
  final bool compact;
  final bool smallValue;
  final bool centered;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(minHeight: compact ? 66 : 74),
      padding: compact
          ? const EdgeInsets.symmetric(horizontal: 12, vertical: 10)
          : const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .70),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x1A0F172A)),
      ),
      child: Column(
        crossAxisAlignment: centered
            ? CrossAxisAlignment.center
            : CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _Kicker(label),
          SizedBox(height: compact ? 8 : 9),
          Text(
            value,
            textAlign: centered ? TextAlign.center : TextAlign.left,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: compact
                  ? smallValue
                        ? 13
                        : 15
                  : 16,
              height: smallValue ? 1.2 : 1.12,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF101828),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyWeather extends StatelessWidget {
  const _EmptyWeather({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Kicker('Pronto per la ricerca'),
        SizedBox(height: 10),
        Text(
          'Cerca una citt\u00e0 per visualizzare il meteo.',
          style: TextStyle(
            fontSize: 46,
            height: .96,
            fontWeight: FontWeight.w900,
            color: Color(0xFF101828),
          ),
        ),
        SizedBox(height: 12),
        Text(
          'La dashboard mostrer\u00e0 temperatura, umidit\u00e0, vento, ora locale, sole, luna e condizioni attuali.',
          style: TextStyle(
            fontSize: 17,
            height: 1.5,
            color: Color(0xFF667085),
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _LoadingWeather extends StatefulWidget {
  const _LoadingWeather({super.key});

  @override
  State<_LoadingWeather> createState() => _LoadingWeatherState();
}

class _LoadingWeatherState extends State<_LoadingWeather>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1250),
    )..repeat();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, child) {
        final progress = _shimmerController.value;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Skeleton(width: 150, height: 16, progress: progress),
            const SizedBox(height: 14),
            _Skeleton(width: double.infinity, height: 64, progress: progress),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _Skeleton(
                    width: double.infinity,
                    height: 112,
                    progress: progress,
                  ),
                ),
                const SizedBox(width: 24),
                _Skeleton(width: 124, height: 124, progress: progress),
              ],
            ),
            const SizedBox(height: 18),
            _Skeleton(width: double.infinity, height: 84, progress: progress),
            const SizedBox(height: 10),
            _Skeleton(width: double.infinity, height: 84, progress: progress),
            const SizedBox(height: 16),
            const Text(
              'Aggiorno il meteo in tempo reale...',
              style: TextStyle(
                color: Color(0xFF667085),
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton({
    required this.width,
    required this.height,
    required this.progress,
  });

  final double width;
  final double height;
  final double progress;

  @override
  Widget build(BuildContext context) {
    final offset = -1.8 + (progress * 3.6);
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          begin: Alignment(offset, 0),
          end: Alignment(offset + 1, 0),
          colors: const [
            Color(0xFFE2E8F0),
            Color(0xFFF8FAFC),
            Color(0xFFE2E8F0),
          ],
          stops: const [0.2, 0.5, 0.8],
        ),
      ),
    );
  }
}

class ExpandedOrIntrinsic extends StatelessWidget {
  const ExpandedOrIntrinsic({
    super.key,
    required this.expanded,
    required this.child,
  });

  final bool expanded;
  final Widget child;

  @override
  Widget build(BuildContext context) =>
      expanded ? Expanded(child: child) : child;
}

class FlexibleOrIntrinsic extends StatelessWidget {
  const FlexibleOrIntrinsic({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final hasBoundedSearchPanel = width <= 620 || width > 1040;

    return hasBoundedSearchPanel ? Expanded(child: child) : child;
  }
}
