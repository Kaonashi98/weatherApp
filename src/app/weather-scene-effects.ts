import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import { WeatherTheme } from './services/weather';

type Cloud = { y: number; phase: number; speed: number; scale: number; opacity: number; seed: number };
type RainDrop = { x: number; phase: number; speed: number; length: number; width: number; opacity: number; slant: number };
type SnowFlake = { index: number };
type Star = { x: number; y: number; radius: number; phase: number; speed: number; speedB: number; warmth: number; bright: boolean };
type Point = { x: number; y: number };
type Strike = { main: Point[]; branches: Point[][] };
type CloudSpec = { count: number; opacity: number; speed: number; color: string };

@Component({
  selector: 'app-weather-scene-effects',
  standalone: true,
  template: '<canvas #canvas class="weather-effects-canvas" aria-hidden="true"></canvas>',
  styles: [':host{position:absolute;inset:0;display:block;pointer-events:none}.weather-effects-canvas{display:block;width:100%;height:100%}'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeatherSceneEffectsComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() theme: WeatherTheme = 'default';
  @Input() cloudCover = 0;
  @Input() weatherCode = 0;
  @Input() windSpeed = 0;
  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  private context: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private frameId: number | null = null;
  private startTime = performance.now();
  private lastFrameTime = 0;
  private clouds: Cloud[] = [];
  private rain: RainDrop[] = [];
  private snow: SnowFlake[] = [];
  private stars: Star[] = [];
  private strikes: Strike[] = [];
  private reducedMotion = false;

  ngAfterViewInit(): void {
    if (globalThis.navigator?.userAgent?.toLowerCase().includes('jsdom')) return;
    try {
      this.context = this.canvasRef.nativeElement.getContext('2d');
    } catch {
      this.context = null;
    }
    if (!this.context) return;
    this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.rebuildScene();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvasRef.nativeElement);
    }
    this.resize();
  }

  ngOnChanges(): void {
    if (this.context) this.rebuildScene();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
  }

  private rebuildScene(): void {
    this.startTime = performance.now();
    const cloudSpec = this.cloudSpec();
    const cloudRandom = this.random((cloudSpec?.count ?? 0) * 17 + Math.round((cloudSpec?.opacity ?? 0) * 100));
    this.clouds = cloudSpec ? Array.from({ length: cloudSpec.count }, (_, index) => ({
      y: 0.22 + index / Math.max(1, cloudSpec.count - 1) * 0.38 + cloudRandom() * 0.06,
      phase: cloudRandom(), speed: cloudSpec.speed * (0.65 + cloudRandom() * 0.7),
      scale: 0.7 + cloudRandom() * 0.9, opacity: cloudSpec.opacity * (0.55 + cloudRandom() * 0.45),
      seed: Math.floor(cloudRandom() * 65536)
    })) : [];

    const rainRandom = this.random(7);
    const heavy = this.theme === 'stormy';
    this.rain = Array.from({ length: heavy ? 108 : 84 }, () => {
      const depth = Math.pow(rainRandom(), 1.55);
      const speed = 0.5 + depth * 0.7 + rainRandom() * 0.18;
      return { x: rainRandom(), phase: rainRandom(), speed: heavy ? speed * 1.15 : speed,
        length: 0.045 + depth * 0.07 + rainRandom() * 0.02, width: 0.45 + depth * (heavy ? 0.95 : 0.7),
        opacity: 0.04 + depth * (heavy ? 0.22 : 0.16), slant: 0.06 + rainRandom() * 0.04 };
    });
    this.snow = Array.from({ length: 104 }, (_, index) => ({ index }));

    const starRandom = this.random(42);
    const dense = this.theme === 'night';
    this.stars = Array.from({ length: dense ? 112 : 36 }, (_, index) => {
      const magnitude = Math.pow(starRandom(), 2.1);
      const topBand = index < (dense ? 42 : 12);
      let x = starRandom();
      let y = topBand ? 0.012 + starRandom() * 0.075 : 0.07 + starRandom() * 0.62;
      const animatedStars = [{ x: 0.245, y: 0.054 }, { x: 0.705, y: 0.041 }, { x: 0.765, y: 0.062 }];
      for (let attempt = 0; attempt < 8 && animatedStars.some((star) => Math.hypot(x - star.x, y - star.y) < 0.038); attempt++) {
        x = starRandom();
        y = topBand ? 0.012 + starRandom() * 0.075 : 0.07 + starRandom() * 0.62;
      }
      return { x, y,
        radius: 0.42 + magnitude * 1.62, phase: starRandom(), speed: 0.35 + starRandom() * 1.8,
        speedB: 0.7 + starRandom() * 2.4, warmth: starRandom(), bright: magnitude > 0.72 };
    });
    this.strikes = this.makeStrikes();
    this.restartLoop();
  }

  private resize(): void {
    if (!this.context) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.draw(performance.now());
  }

  private restartLoop(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    if (this.reducedMotion) { this.draw(this.startTime + 3700); return; }
    const tick = (now: number) => {
      if (now - this.lastFrameTime >= 1000 / 30) {
        this.draw(now);
        this.lastFrameTime = now;
      }
      this.frameId = requestAnimationFrame(tick);
    };
    this.frameId = requestAnimationFrame(tick);
  }

  private draw(now: number): void {
    const context = this.context;
    if (!context) return;
    const canvas = this.canvasRef.nativeElement;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    context.clearRect(0, 0, width, height);
    const seconds = (now - this.startTime) / 1000;

    if (this.isNightTheme()) this.drawStars(context, width, height, seconds);
    const cloudSpec = this.cloudSpec();
    if (cloudSpec) this.drawClouds(context, width, height, seconds, cloudSpec);
    if (this.theme === 'rainy' || this.theme === 'stormy') this.drawRain(context, width, height, seconds, this.theme === 'stormy');
    if (this.theme === 'snowy') { this.drawSnow(context, width, height, seconds); this.drawFog(context, width, height, seconds, false); }
    if (this.theme === 'foggy') this.drawFog(context, width, height, seconds, true);
    if (this.theme === 'stormy') this.drawLightning(context, width, height, seconds);
  }

  private cloudSpec(): CloudSpec | null {
    const coverage = this.clamp(this.cloudCover / 100);
    const windFactor = 0.72 + this.clamp(this.windSpeed / 65) * 0.7;
    if (['sunrise', 'sunset', 'sunset-glow'].includes(this.theme)) {
      if (this.cloudCover <= 15) return null;
      return { count: 2 + Math.round(coverage * 5), opacity: 0.2 + coverage * 0.22, speed: 0.2 * windFactor, color: this.theme === 'sunrise' ? '#ffe4d6' : '#e9d5ff' };
    }
    if (this.theme === 'partly-cloudy') return { count: Math.max(2, Math.round(coverage * 7)), opacity: 0.24 + coverage * 0.28, speed: 0.34 * windFactor, color: '#f8fafc' };
    if (this.theme === 'cloudy') return { count: 5 + Math.round(coverage * 4), opacity: 0.36 + coverage * 0.18, speed: 0.25 * windFactor, color: '#e2e8f0' };
    if (this.theme === 'partly-cloudy-night') return { count: Math.max(2, Math.round(coverage * 7)), opacity: 0.2 + coverage * 0.2, speed: 0.22 * windFactor, color: '#94a3b8' };
    if (this.theme === 'cloudy-night') return { count: 5 + Math.round(coverage * 3), opacity: 0.26 + coverage * 0.14, speed: 0.18 * windFactor, color: '#64748b' };
    if (this.theme === 'rainy') return { count: 5 + Math.round(coverage * 3), opacity: 0.3 + coverage * 0.1, speed: 0.28 * windFactor, color: '#94a3b8' };
    if (this.theme === 'stormy') return { count: 7 + Math.round(coverage * 3), opacity: 0.38 + coverage * 0.1, speed: 0.42 * windFactor, color: '#475569' };
    if (this.theme === 'snowy') return { count: 4 + Math.round(coverage * 3), opacity: 0.28 + coverage * 0.12, speed: 0.15 * windFactor, color: '#f1f5f9' };
    if (this.theme === 'foggy') return { count: 4, opacity: 0.22, speed: 0.1 * windFactor, color: '#e2e8f0' };
    return null;
  }

  private drawClouds(context: CanvasRenderingContext2D, width: number, height: number, seconds: number, spec: CloudSpec): void {
    const span = width + 420;
    for (const cloud of this.clouds) {
      const cycle = (cloud.phase + seconds / 40 * cloud.speed) % 1;
      const x = cycle * span - 210;
      const y = cloud.y * height;
      const random = this.random(cloud.seed);
      const cloudWidth = (150 + random() * 70) * cloud.scale;
      const cloudHeight = (46 + random() * 18) * cloud.scale;
      const puffs = [{ x, y, rx: cloudWidth / 2, ry: cloudHeight / 2 }];
      for (let index = 0; index < 6; index++) puffs.push({
        x: x + cloudWidth * (-0.36 + index * 0.145), y: y - cloudHeight * (0.08 + random() * 0.34),
        rx: cloudWidth * (0.26 + random() * 0.2) / 2, ry: cloudHeight * (0.62 + random() * 0.55) / 2
      });
      context.save(); context.globalAlpha = cloud.opacity;
      context.fillStyle = '#0f172a'; context.globalAlpha *= 0.18; context.filter = `blur(${7 * cloud.scale}px)`;
      for (const puff of puffs) this.ellipse(context, puff.x, puff.y + cloudHeight * 0.12, puff.rx, puff.ry);
      context.filter = `blur(${1.8 * cloud.scale}px)`; context.fillStyle = spec.color; context.globalAlpha = cloud.opacity;
      for (const puff of puffs) this.ellipse(context, puff.x, puff.y, puff.rx, puff.ry);
      context.filter = `blur(${3.2 * cloud.scale}px)`; context.fillStyle = '#ffffff'; context.globalAlpha = cloud.opacity * 0.34;
      for (const puff of puffs.slice(1, 5)) this.ellipse(context, puff.x, puff.y - puff.ry * 0.32, puff.rx * 0.72, puff.ry * 0.42);
      context.restore();
    }
  }

  private drawRain(context: CanvasRenderingContext2D, width: number, height: number, seconds: number, heavy: boolean): void {
    const progress = (seconds % (heavy ? 1.2 : 1.5)) / (heavy ? 1.2 : 1.5);
    const intensity = this.precipitationIntensity();
    const visible = Math.max(16, Math.round(this.rain.length * intensity));
    const travel = height + 90;
    const windSlant = 0.62 + this.clamp(this.windSpeed / 70) * 1.2;
    context.save(); context.strokeStyle = '#e8f1fa'; context.lineCap = 'round';
    for (const drop of this.rain.slice(0, visible)) {
      const cycle = (progress * drop.speed + drop.phase) % 1;
      const length = drop.length * height;
      const y = cycle * travel - length;
      const x = (drop.x * width + cycle * drop.slant * height * 0.22) % (width + 48) - 24;
      context.globalAlpha = drop.opacity * (0.62 + intensity * 0.38) * (drop.opacity < 0.12 ? 0.78 : 1);
      context.lineWidth = drop.width * (drop.opacity < 0.12 ? 0.82 : 1);
      context.beginPath(); context.moveTo(x, y); context.lineTo(x + length * drop.slant * windSlant, y + length); context.stroke();
    }
    context.restore();
  }

  private drawSnow(context: CanvasRenderingContext2D, width: number, height: number, seconds: number): void {
    const progress = (seconds % 8) / 8;
    const intensity = this.snowIntensity();
    const count = 32 + Math.round(intensity * 72);
    context.save(); context.fillStyle = '#fff';
    for (const flake of this.snow.slice(0, count)) {
      const i = flake.index; const depth = 0.35 + i % 5 * 0.13;
      const x = (i * 53 + Math.sin(progress * Math.PI * 2 + i) * (18 + depth * 16)) % width;
      const y = (i * 61 + progress * (height + 80) * (0.55 + depth)) % (height + 80) - 40;
      context.globalAlpha = 0.4 + depth * 0.5; context.beginPath(); context.arc(x, y, 1.1 + depth * 2.4, 0, Math.PI * 2); context.fill();
    }
    context.restore();
  }

  private drawFog(context: CanvasRenderingContext2D, width: number, height: number, seconds: number, heavy: boolean): void {
    const progress = (seconds % (heavy ? 22 : 28)) / (heavy ? 22 : 28);
    context.save(); context.fillStyle = '#fff'; context.filter = 'blur(12px)';
    for (let index = 0; index < (heavy ? 5 : 3); index++) {
      const phase = (progress * (0.35 + index * 0.12) + index * 0.27) % 1;
      context.globalAlpha = (heavy ? 0.16 : 0.1) + index * 0.03;
      this.ellipse(context, phase * (width + 220) - 110, height * (0.42 + index * 0.12), width * (0.7 + index * 0.08) / 2, (70 + index * 18) / 2);
    }
    context.restore();
  }

  private drawStars(context: CanvasRenderingContext2D, width: number, height: number, seconds: number): void {
    const progress = 0.37;
    const dim = this.theme !== 'night' && this.theme !== 'sunset-glow';
    const factor = dim ? 0.42 : 1;
    context.save();
    for (const star of this.stars) {
      const waveA = 0.5 + 0.5 * Math.sin((progress * star.speed + star.phase) * Math.PI * 2);
      const waveB = 0.5 + 0.5 * Math.sin((progress * star.speedB + star.phase * 1.37) * Math.PI * 2);
      const twinkle = 1 - (0.18 + star.y * 0.55) + (0.18 + star.y * 0.55) * (0.55 * waveA + 0.45 * waveB);
      const alpha = (0.22 + 0.78 * twinkle) * factor;
      const color = this.mixColor('#dbeafe', '#fff1d6', star.warmth);
      context.fillStyle = color; context.globalAlpha = alpha; context.beginPath();
      context.arc(star.x * width, star.y * height, star.radius * (0.75 + 0.35 * twinkle), 0, Math.PI * 2); context.fill();
      if (star.bright && twinkle > 0.78 && !dim) {
        const spike = 3.2 + star.radius * 3.4 * ((twinkle - 0.78) / 0.22);
        context.strokeStyle = color; context.globalAlpha = alpha * 0.55; context.lineWidth = 0.7;
        context.beginPath(); context.moveTo(star.x * width, star.y * height - spike); context.lineTo(star.x * width, star.y * height + spike);
        context.moveTo(star.x * width - spike * 0.7, star.y * height); context.lineTo(star.x * width + spike * 0.7, star.y * height); context.stroke();
      }
    }
    if (!dim) this.drawTwinklingStars(context, width, height, seconds);
    context.restore();
  }

  private drawTwinklingStars(context: CanvasRenderingContext2D, width: number, height: number, seconds: number): void {
    const progress = Math.floor((seconds % 8) / 8 * 80) / 80;
    const stars = [
      { x: 0.245, y: 0.054, phase: 0.02, size: 1, warmth: 0.18 },
      { x: 0.705, y: 0.041, phase: 0.38, size: 0.92, warmth: 0.72 },
      { x: 0.765, y: 0.062, phase: 0.71, size: 0.78, warmth: 0.42 }
    ];
    for (const star of stars) {
      const waveA = 0.5 + 0.5 * Math.sin((progress + star.phase) * Math.PI * 2);
      const waveB = 0.5 + 0.5 * Math.sin((progress * 1.73 + star.phase * 2.1) * Math.PI * 2);
      const brightness = this.clamp(0.16 + 0.84 * (waveA * 0.72 + waveB * 0.28));
      const x = star.x * width; const y = star.y * height;
      const color = this.mixColor('#dcebff', '#fff1d6', star.warmth);
      context.fillStyle = color; context.globalAlpha = 0.055 + brightness * 0.1;
      context.beginPath(); context.arc(x, y, (5.2 + brightness * 3) * star.size, 0, Math.PI * 2); context.fill();
      context.globalAlpha = 0.22 + brightness * 0.68;
      context.beginPath(); context.arc(x, y, (0.9 + brightness * 1.05) * star.size, 0, Math.PI * 2); context.fill();
      if (brightness < 0.48) continue;
      const flare = this.clamp((brightness - 0.48) / 0.52);
      const vertical = (3.8 + flare * 6.5) * star.size;
      const horizontal = vertical * 0.68;
      context.strokeStyle = color; context.globalAlpha = 0.16 + flare * 0.56; context.lineWidth = 0.55 + flare * 0.35;
      context.beginPath(); context.moveTo(x, y - vertical); context.lineTo(x, y + vertical);
      context.moveTo(x - horizontal, y); context.lineTo(x + horizontal, y); context.stroke();
    }
  }

  private drawLightning(context: CanvasRenderingContext2D, width: number, height: number, seconds: number): void {
    const t = (seconds % 11) / 11;
    const pulses = [Math.max(this.pulse(t, 0.170, 0.182), this.pulse(t, 0.188, 0.197) * 0.34),
      Math.max(this.pulse(t, 0.531, 0.544), this.pulse(t, 0.551, 0.559) * 0.25), this.pulse(t, 0.879, 0.890) * 0.78];
    const intensity = Math.max(...pulses); if (intensity <= 0) return;
    const strike = this.strikes[pulses.indexOf(intensity)];
    context.save(); context.fillStyle = '#e8f3ff'; context.globalAlpha = 0.055 * intensity; context.fillRect(0, 0, width, height);
    const drawPath = (points: Point[], lineWidth: number, color: string, alpha: number, blur = 0) => {
      context.beginPath(); context.moveTo(points[0].x * width, points[0].y * height); for (const point of points.slice(1)) context.lineTo(point.x * width, point.y * height);
      context.strokeStyle = color; context.globalAlpha = alpha * intensity; context.lineWidth = lineWidth; context.lineCap = 'round'; context.lineJoin = 'round'; context.shadowBlur = blur; context.shadowColor = color; context.stroke();
    };
    drawPath(strike.main, 13, '#93c5fd', 0.46, 9); drawPath(strike.main, 5.5, '#dceeff', 0.72); drawPath(strike.main, 2.2, '#fff', 0.98);
    for (const branch of strike.branches) { drawPath(branch, 7, '#aed7ff', 0.32, 5); drawPath(branch, 1.25, '#fff', 0.72); }
    context.restore();
  }

  private makeStrikes(): Strike[] {
    const random = this.random(21); const origins = [0.3, 0.57, 0.77];
    return origins.map((origin, index) => {
      const main: Point[] = [{ x: origin, y: 0.006 }]; let x = origin; let y = 0.006;
      for (let i = 0; i < 13; i++) { const upper = i < 5; const direction = (i + index) % 2 === 0 ? 1 : -1;
        x += direction * (upper ? 0.026 + random() * 0.028 : 0.018 + random() * 0.055) + (random() - 0.5) * 0.016;
        y += upper ? 0.009 + random() * 0.004 : 0.065 + random() * 0.035; main.push({ x: this.clamp(x, 0.08, 0.92), y: this.clamp(y, 0, 0.96) }); }
      const branches = [2, 4, 7].map((start) => { const points: Point[] = [main[start]]; let bx = main[start].x; let by = main[start].y; const direction = (start + index) % 2 === 0 ? 1 : -1;
        for (let i = 0; i < (start < 5 ? 3 : 2); i++) { bx += direction * (0.024 + random() * 0.032); by += start < 5 ? 0.008 + random() * 0.006 : 0.035 + random() * 0.025; points.push({ x: this.clamp(bx, 0.06, 0.94), y: this.clamp(by, 0, 0.97) }); } return points; });
      return { main, branches };
    });
  }

  private precipitationIntensity(): number {
    if ([51, 56].includes(this.weatherCode)) return 0.3; if ([53, 61, 66, 80].includes(this.weatherCode)) return 0.52;
    if ([55, 57, 63, 67, 81].includes(this.weatherCode)) return 0.74; if ([65, 82].includes(this.weatherCode)) return 1; return 0.58;
  }
  private snowIntensity(): number { if ([71, 77, 85].includes(this.weatherCode)) return 0.42; if (this.weatherCode === 73) return 0.68; return [75, 86].includes(this.weatherCode) ? 1 : 0.62; }
  private isNightTheme(): boolean { return ['night', 'partly-cloudy-night', 'cloudy-night', 'sunset-glow'].includes(this.theme); }
  private pulse(value: number, start: number, end: number): number { if (value <= start || value >= end) return 0; const progress = (value - start) / (end - start); return progress < 0.2 ? 1 - Math.pow(1 - progress / 0.2, 3) : Math.pow(this.clamp(1 - (progress - 0.2) / 0.8), 2.2); }
  private ellipse(context: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void { context.beginPath(); context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); context.fill(); }
  private clamp(value: number, min = 0, max = 1): number { return Math.min(max, Math.max(min, value)); }
  private random(seed: number): () => number { let value = seed || 1; return () => { value = value * 1664525 + 1013904223 >>> 0; return value / 4294967296; }; }
  private mixColor(first: string, second: string, amount: number): string { const a = this.hex(first); const b = this.hex(second); return `rgb(${Math.round(a[0] + (b[0] - a[0]) * amount)},${Math.round(a[1] + (b[1] - a[1]) * amount)},${Math.round(a[2] + (b[2] - a[2]) * amount)})`; }
  private hex(value: string): [number, number, number] { const clean = value.slice(1); return [Number.parseInt(clean.slice(0, 2), 16), Number.parseInt(clean.slice(2, 4), 16), Number.parseInt(clean.slice(4, 6), 16)]; }
}
