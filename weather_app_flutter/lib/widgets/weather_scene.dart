import 'dart:math';

import 'package:flutter/material.dart';

import '../models/weather_models.dart';

class WeatherScene extends StatelessWidget {
  const WeatherScene({super.key, required this.theme, this.orbTop = 0.07});

  final WeatherTheme theme;
  final double orbTop;

  static const _assetBase = 'assets/condizioni_atmosferiche';

  @override
  Widget build(BuildContext context) {
    final spec = _ThemeSpec.fromTheme(theme);
    final isNight =
        theme == WeatherTheme.night ||
        theme == WeatherTheme.partlyCloudyNight ||
        theme == WeatherTheme.cloudyNight;
    final showSun =
        theme == WeatherTheme.sunny ||
        theme == WeatherTheme.partlyCloudy ||
        theme == WeatherTheme.sunrise ||
        theme == WeatherTheme.sunset;
    final showMoon = isNight;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 650),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: spec.gradient,
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (spec.backgroundAsset != null)
            AnimatedOpacity(
              duration: const Duration(milliseconds: 650),
              opacity: spec.assetOpacity,
              child: Image.asset(
                '$_assetBase/${spec.backgroundAsset}',
                fit: BoxFit.cover,
                color: spec.tint,
                colorBlendMode: spec.tint == null
                    ? BlendMode.srcOver
                    : BlendMode.modulate,
              ),
            ),
          if (theme == WeatherTheme.night) const _StarsLayer(),
          if (showSun || showMoon)
            AnimatedPositioned(
              duration: const Duration(milliseconds: 650),
              right: -28,
              top: MediaQuery.of(context).size.height * orbTop,
              child: _Orb(
                asset: showMoon ? 'luna.png' : 'sole_senzasfondo.png',
                glowColor: showMoon ? Colors.white : const Color(0xFFFFE082),
              ),
            ),
          if (theme == WeatherTheme.rainy || theme == WeatherTheme.stormy)
            const _RainLayer(),
          if (theme == WeatherTheme.snowy) const _SnowLayer(),
          if (theme == WeatherTheme.foggy || theme == WeatherTheme.snowy)
            const _FogLayer(),
          if (theme == WeatherTheme.stormy) const _LightningLayer(),
          Container(color: Colors.black.withValues(alpha: spec.overlayOpacity)),
        ],
      ),
    );
  }
}

class _ThemeSpec {
  const _ThemeSpec({
    required this.gradient,
    required this.assetOpacity,
    required this.overlayOpacity,
    this.backgroundAsset,
    this.tint,
  });

  final List<Color> gradient;
  final String? backgroundAsset;
  final double assetOpacity;
  final double overlayOpacity;
  final Color? tint;

  factory _ThemeSpec.fromTheme(WeatherTheme theme) {
    switch (theme) {
      case WeatherTheme.sunny:
        return const _ThemeSpec(
          gradient: [Color(0xFF7DD3FC), Color(0xFF38BDF8), Color(0xFF0284C7)],
          backgroundAsset: 'cielo_sereno.png',
          assetOpacity: 0.45,
          overlayOpacity: 0,
        );
      case WeatherTheme.partlyCloudy:
        return const _ThemeSpec(
          gradient: [Color(0xFFFDE68A), Color(0xFF60A5FA), Color(0xFF0284C7)],
          backgroundAsset: 'nuvole.png',
          assetOpacity: 0.7,
          overlayOpacity: 0,
        );
      case WeatherTheme.cloudy:
        return const _ThemeSpec(
          gradient: [Color(0xFF64748B), Color(0xFF94A3B8), Color(0xFFCBD5E1)],
          backgroundAsset: 'nuvole.png',
          assetOpacity: 0.72,
          overlayOpacity: 0.02,
        );
      case WeatherTheme.rainy:
        return const _ThemeSpec(
          gradient: [Color(0xFF0F172A), Color(0xFF1E3A8A), Color(0xFF075985)],
          backgroundAsset: 'pioggia.png',
          assetOpacity: 1,
          overlayOpacity: 0.08,
        );
      case WeatherTheme.snowy:
        return const _ThemeSpec(
          gradient: [Color(0xFFC7D2FE), Color(0xFFE0F2FE), Color(0xFFF8FAFC)],
          backgroundAsset: 'neve.png',
          assetOpacity: 0.72,
          overlayOpacity: 0,
        );
      case WeatherTheme.stormy:
        return const _ThemeSpec(
          gradient: [Color(0xFF020617), Color(0xFF111827), Color(0xFF312E81)],
          backgroundAsset: 'temporale.png',
          assetOpacity: 0.98,
          overlayOpacity: 0.12,
        );
      case WeatherTheme.foggy:
        return const _ThemeSpec(
          gradient: [Color(0xFF64748B), Color(0xFFCBD5E1), Color(0xFFF1F5F9)],
          backgroundAsset: 'nebbia.png',
          assetOpacity: 0.74,
          overlayOpacity: 0.03,
        );
      case WeatherTheme.sunrise:
        return const _ThemeSpec(
          gradient: [
            Color(0xFF214B8F),
            Color(0xFFE7A4BD),
            Color(0xFFFFD08A),
            Color(0xFFFF8F5D),
          ],
          backgroundAsset: 'cielo_alba.png',
          assetOpacity: 0.86,
          overlayOpacity: 0,
        );
      case WeatherTheme.sunset:
      case WeatherTheme.sunsetGlow:
        return const _ThemeSpec(
          gradient: [
            Color(0xFF2D1B55),
            Color(0xFF71365F),
            Color(0xFFD05243),
            Color(0xFFFF8A2A),
          ],
          backgroundAsset: 'cielo_tramonto.png',
          assetOpacity: 0.88,
          overlayOpacity: 0.04,
        );
      case WeatherTheme.night:
        return const _ThemeSpec(
          gradient: [Color(0xFF020617), Color(0xFF111827), Color(0xFF1E1B4B)],
          backgroundAsset: 'cielo_stellato.png',
          assetOpacity: 0.72,
          overlayOpacity: 0.08,
        );
      case WeatherTheme.partlyCloudyNight:
      case WeatherTheme.cloudyNight:
        return const _ThemeSpec(
          gradient: [Color(0xFF020617), Color(0xFF172033), Color(0xFF334155)],
          backgroundAsset: 'nuvole.png',
          assetOpacity: 0.85,
          overlayOpacity: 0.22,
          tint: Color(0xFF9CA3AF),
        );
      case WeatherTheme.standard:
        return const _ThemeSpec(
          gradient: [Color(0xFF2563EB), Color(0xFF0891B2), Color(0xFF0F766E)],
          assetOpacity: 0,
          overlayOpacity: 0,
        );
    }
  }
}

class _Orb extends StatelessWidget {
  const _Orb({required this.asset, required this.glowColor});

  final String asset;
  final Color glowColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 190,
      height: 190,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: glowColor.withValues(alpha: 0.42),
            blurRadius: 60,
            spreadRadius: 24,
          ),
        ],
      ),
      child: Image.asset(
        'assets/condizioni_atmosferiche/$asset',
        fit: BoxFit.contain,
      ),
    );
  }
}

class _RainLayer extends StatefulWidget {
  const _RainLayer();

  @override
  State<_RainLayer> createState() => _RainLayerState();
}

class _RainLayerState extends State<_RainLayer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 650),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, __) => CustomPaint(painter: _RainPainter(_controller.value)),
    );
  }
}

class _RainPainter extends CustomPainter {
  const _RainPainter(this.progress);

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.55)
      ..strokeWidth = 1.7
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 90; i++) {
      final x = (i * 47.0 + progress * 140) % (size.width + 80) - 40;
      final y = (i * 83.0 + progress * 520) % (size.height + 80) - 40;
      canvas.drawLine(Offset(x, y), Offset(x - 18, y + 34), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _RainPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

class _SnowLayer extends StatefulWidget {
  const _SnowLayer();

  @override
  State<_SnowLayer> createState() => _SnowLayerState();
}

class _SnowLayerState extends State<_SnowLayer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 8),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, __) => CustomPaint(painter: _SnowPainter(_controller.value)),
    );
  }
}

class _SnowPainter extends CustomPainter {
  const _SnowPainter(this.progress);

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.86);
    for (var i = 0; i < 80; i++) {
      final x = (i * 53.0 + sin(progress * pi * 2 + i) * 28) % size.width;
      final y =
          (i * 61.0 + progress * (size.height + 80)) % (size.height + 80) - 40;
      canvas.drawCircle(Offset(x, y), 1.4 + (i % 3), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SnowPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

class _FogLayer extends StatelessWidget {
  const _FogLayer();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Column(
        children: [
          const Spacer(),
          Container(
            height: 220,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.white.withValues(alpha: 0),
                  Colors.white.withValues(alpha: 0.42),
                  Colors.white.withValues(alpha: 0),
                ],
              ),
            ),
          ),
          const Spacer(),
        ],
      ),
    );
  }
}

class _LightningLayer extends StatefulWidget {
  const _LightningLayer();

  @override
  State<_LightningLayer> createState() => _LightningLayerState();
}

class _LightningLayerState extends State<_LightningLayer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 6),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, __) {
        final flash = _controller.value > 0.86 && _controller.value < 0.92;
        return Stack(
          children: [
            if (flash) Container(color: Colors.white.withValues(alpha: 0.18)),
            if (flash)
              Positioned(
                right: 72,
                top: 20,
                child: Icon(
                  Icons.flash_on,
                  color: Colors.yellow.shade200,
                  size: 150,
                  shadows: const [Shadow(color: Colors.white, blurRadius: 28)],
                ),
              ),
          ],
        );
      },
    );
  }
}

class _StarsLayer extends StatelessWidget {
  const _StarsLayer();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _StarsPainter());
  }
}

class _StarsPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.82);
    const points = [
      Offset(.12, .18),
      Offset(.28, .42),
      Offset(.54, .20),
      Offset(.78, .64),
      Offset(.88, .28),
      Offset(.42, .74),
    ];
    for (final point in points) {
      canvas.drawCircle(
        Offset(point.dx * size.width, point.dy * size.height),
        2,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
