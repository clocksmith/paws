/**
 * Theme Helper Utilities
 *
 * Provides color adaptation, contrast calculation, and theming utilities
 * for widgets with complex color requirements.
 */

import type { ColorAdaptationOptions } from '../types/dependencies.js';

/**
 * Color conversion and manipulation utilities
 */
export class ThemeUtils {
  /**
   * Parse a color string to RGB values
   * Supports hex (#RGB, #RRGGBB), rgb(r,g,b), rgba(r,g,b,a), and named colors
   */
  static parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      let r: number, g: number, b: number;

      if (hex.length === 3) {
        const r0 = hex[0];
        const g0 = hex[1];
        const b0 = hex[2];
        if (!r0 || !g0 || !b0) return null;
        r = parseInt(r0 + r0, 16);
        g = parseInt(g0 + g0, 16);
        b = parseInt(b0 + b0, 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      } else {
        return null;
      }

      return { r, g, b, a: 1 };
    }

    // Handle rgb/rgba colors
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
      return {
        r: parseInt(rgbMatch[1], 10),
        g: parseInt(rgbMatch[2], 10),
        b: parseInt(rgbMatch[3], 10),
        a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
      };
    }

    return null;
  }

  /**
   * Convert RGB to HSL
   */
  static rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const l = (max + min) / 2;

    if (diff === 0) {
      return { h: 0, s: 0, l };
    }

    const s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

    let h = 0;
    if (max === r) {
      h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / diff + 2) / 6;
    } else {
      h = ((r - g) / diff + 4) / 6;
    }

    return { h: h * 360, s, l };
  }

  /**
   * Convert HSL to RGB
   */
  static hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h /= 360;

    if (s === 0) {
      const gray = Math.round(l * 255);
      return { r: gray, g: gray, b: gray };
    }

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    return {
      r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      g: Math.round(hue2rgb(p, q, h) * 255),
      b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    };
  }

  /**
   * Convert RGB to hex
   */
  static rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Calculate relative luminance (WCAG 2.0)
   */
  static getRelativeLuminance(r: number, g: number, b: number): number {
    const values = [r, g, b].map((c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    const [rs, gs, bs] = values;
    if (rs === undefined || gs === undefined || bs === undefined) {
      throw new Error('Invalid RGB values');
    }
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate contrast ratio between two colors (WCAG 2.0)
   * Returns a value between 1 and 21
   */
  static getContrastRatio(color1: string, color2: string): number {
    const c1 = this.parseColor(color1);
    const c2 = this.parseColor(color2);

    if (!c1 || !c2) {
      return 1;
    }

    const l1 = this.getRelativeLuminance(c1.r, c1.g, c1.b);
    const l2 = this.getRelativeLuminance(c2.r, c2.g, c2.b);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Adapt a color to the current theme mode
   * Adjusts brightness and saturation for visibility
   */
  static adaptColor(
    color: string,
    mode: 'light' | 'dark',
    options: ColorAdaptationOptions = {}
  ): string {
    const parsed = this.parseColor(color);
    if (!parsed) {
      return color;
    }

    const { r, g, b } = parsed;
    const hsl = this.rgbToHsl(r, g, b);

    const {
      respectMode = true,
      preserveHue = true,
      targetContrast,
      intensity = 0,
    } = options;

    let { h, s, l } = hsl;

    // Preserve hue by default
    if (!preserveHue) {
      // Allow hue to shift slightly based on mode
      h = mode === 'dark' ? (h + 5) % 360 : (h - 5 + 360) % 360;
    }

    if (respectMode) {
      if (mode === 'dark') {
        // For dark mode: increase saturation slightly, adjust lightness
        s = Math.min(1, s * 1.1);
        l = l < 0.5 ? Math.min(0.9, l + 0.3) : Math.max(0.6, l - 0.1);
      } else {
        // For light mode: keep colors vibrant but not too bright
        s = Math.min(1, s * 0.95);
        l = l > 0.5 ? Math.max(0.2, l - 0.2) : Math.min(0.7, l + 0.1);
      }
    }

    // Apply intensity adjustment
    if (intensity !== 0) {
      l = Math.max(0, Math.min(1, l + intensity * 0.2));
    }

    // Convert back to RGB
    const rgb = this.hslToRgb(h, s, l);

    // If target contrast specified, adjust lightness to meet it
    if (targetContrast !== undefined) {
      const bgColor = mode === 'dark' ? '#1e1e1e' : '#ffffff';
      let currentContrast = this.getContrastRatio(
        this.rgbToHex(rgb.r, rgb.g, rgb.b),
        bgColor
      );

      let attempts = 0;
      while (Math.abs(currentContrast - targetContrast) > 0.5 && attempts < 10) {
        if (currentContrast < targetContrast) {
          l = mode === 'dark' ? l + 0.05 : l - 0.05;
        } else {
          l = mode === 'dark' ? l - 0.05 : l + 0.05;
        }
        l = Math.max(0, Math.min(1, l));

        const adjustedRgb = this.hslToRgb(h, s, l);
        currentContrast = this.getContrastRatio(
          this.rgbToHex(adjustedRgb.r, adjustedRgb.g, adjustedRgb.b),
          bgColor
        );

        rgb.r = adjustedRgb.r;
        rgb.g = adjustedRgb.g;
        rgb.b = adjustedRgb.b;

        attempts++;
      }
    }

    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Generate a color scale from a base color
   * Creates lighter and darker variants
   */
  static generateColorScale(baseColor: string, steps: number = 5): string[] {
    const parsed = this.parseColor(baseColor);
    if (!parsed) {
      return Array(steps).fill(baseColor);
    }

    const { r, g, b } = parsed;
    const hsl = this.rgbToHsl(r, g, b);

    const colors: string[] = [];
    const middle = Math.floor(steps / 2);

    for (let i = 0; i < steps; i++) {
      const offset = (i - middle) / steps;
      const l = Math.max(0, Math.min(1, hsl.l + offset));
      const rgb = this.hslToRgb(hsl.h, hsl.s, l);
      colors.push(this.rgbToHex(rgb.r, rgb.g, rgb.b));
    }

    return colors;
  }

  /**
   * Check if a color meets WCAG AA contrast requirements
   */
  static meetsWCAG_AA(foreground: string, background: string, largeText: boolean = false): boolean {
    const ratio = this.getContrastRatio(foreground, background);
    return largeText ? ratio >= 3 : ratio >= 4.5;
  }

  /**
   * Check if a color meets WCAG AAA contrast requirements
   */
  static meetsWCAG_AAA(foreground: string, background: string, largeText: boolean = false): boolean {
    const ratio = this.getContrastRatio(foreground, background);
    return largeText ? ratio >= 4.5 : ratio >= 7;
  }

  /**
   * Generate semantic color variants (light, medium, dark)
   */
  static generateSemanticVariants(baseColor: string): [string, string, string] {
    const parsed = this.parseColor(baseColor);
    if (!parsed) {
      return [baseColor, baseColor, baseColor];
    }

    const { r, g, b } = parsed;
    const hsl = this.rgbToHsl(r, g, b);

    // Light variant: increase lightness
    const light = this.hslToRgb(hsl.h, hsl.s * 0.6, Math.min(1, hsl.l + 0.3));

    // Medium variant: base color
    const medium = { r, g, b };

    // Dark variant: decrease lightness
    const dark = this.hslToRgb(hsl.h, Math.min(1, hsl.s * 1.2), Math.max(0, hsl.l - 0.2));

    return [
      this.rgbToHex(light.r, light.g, light.b),
      this.rgbToHex(medium.r, medium.g, medium.b),
      this.rgbToHex(dark.r, dark.g, dark.b),
    ];
  }

  /**
   * Apply scoped theming to an element
   * Injects CSS custom properties based on scope configuration
   */
  static applyScopedTheming(
    element: HTMLElement,
    scope: 'host' | 'custom',
    customTokens?: Record<string, string>
  ): void {
    if (scope === 'custom' && customTokens) {
      Object.entries(customTokens).forEach(([key, value]) => {
        element.style.setProperty(key, value);
      });
    }
    element.setAttribute('data-theme-scope', scope);
  }
}

/**
 * Default color palettes
 */
export const DEFAULT_ACCENT_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
];

export const DEFAULT_DATA_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
];

export const DEFAULT_SEMANTIC_COLORS = {
  success: {
    light: '#d1fae5',
    medium: '#10b981',
    dark: '#065f46',
  },
  warning: {
    light: '#fef3c7',
    medium: '#f59e0b',
    dark: '#92400e',
  },
  error: {
    light: '#fee2e2',
    medium: '#ef4444',
    dark: '#991b1b',
  },
  info: {
    light: '#dbeafe',
    medium: '#3b82f6',
    dark: '#1e40af',
  },
};
