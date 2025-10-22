/**
 * Dashboard Themes
 *
 * Pre-configured themes for common design systems.
 */

import type { ThemeConfiguration } from '@mcp-wp/core';

/**
 * Default Theme
 */
export const defaultTheme: ThemeConfiguration = {
  mode: 'light',
  primary: '#0969da',
  secondary: '#8b949e',
  surface: '#ffffff',
  background: '#f6f8fa',
  text: '#24292f',
  border: '#d0d7de',
  error: '#cf222e',
  warning: '#d29922',
  success: '#1a7f37',
  info: '#0969da',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  fontSize: 14,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: 6,
  shadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
};

/**
 * GitHub Theme (Light)
 */
export const githubLight: ThemeConfiguration = {
  mode: 'light',
  primary: '#0969da',
  secondary: '#8b949e',
  surface: '#ffffff',
  background: '#f6f8fa',
  text: '#24292f',
  border: '#d0d7de',
  error: '#cf222e',
  warning: '#d29922',
  success: '#1a7f37',
  info: '#0969da',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  fontSize: 14,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: 6,
  shadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
};

/**
 * GitHub Theme (Dark)
 */
export const githubDark: ThemeConfiguration = {
  mode: 'dark',
  primary: '#58a6ff',
  secondary: '#8b949e',
  surface: '#0d1117',
  background: '#010409',
  text: '#c9d1d9',
  border: '#30363d',
  error: '#f85149',
  warning: '#d29922',
  success: '#3fb950',
  info: '#58a6ff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  fontSize: 14,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: 6,
  shadow: '0 0 0 1px #30363d',
};

/**
 * VS Code Theme (Light)
 */
export const vscodeLight: ThemeConfiguration = {
  mode: 'light',
  primary: '#007acc',
  secondary: '#616161',
  surface: '#ffffff',
  background: '#f3f3f3',
  text: '#000000',
  border: '#e5e5e5',
  error: '#e51400',
  warning: '#ff8c00',
  success: '#107c10',
  info: '#007acc',
  fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  fontSize: 13,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: 4,
  shadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
};

/**
 * VS Code Theme (Dark)
 */
export const vscodeDark: ThemeConfiguration = {
  mode: 'dark',
  primary: '#0e639c',
  secondary: '#cccccc',
  surface: '#1e1e1e',
  background: '#252526',
  text: '#cccccc',
  border: '#3e3e42',
  error: '#f48771',
  warning: '#cca700',
  success: '#89d185',
  info: '#75beff',
  fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  fontSize: 13,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: 4,
  shadow: '0 2px 8px rgba(0, 0, 0, 0.36)',
};

/**
 * Notion Theme (Light)
 */
export const notionLight: ThemeConfiguration = {
  mode: 'light',
  primary: '#2383e2',
  secondary: '#787774',
  surface: '#ffffff',
  background: '#f7f6f3',
  text: '#37352f',
  border: '#e9e9e7',
  error: '#eb5757',
  warning: '#f2994a',
  success: '#219653',
  info: '#2383e2',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: 14,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: 3,
  shadow: 'rgba(15, 15, 15, 0.05) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px',
};

/**
 * Notion Theme (Dark)
 */
export const notionDark: ThemeConfiguration = {
  mode: 'dark',
  primary: '#5e9eff',
  secondary: '#9b9a97',
  surface: '#191919',
  background: '#2f3437',
  text: '#ffffff',
  border: '#373737',
  error: '#ff6b6b',
  warning: '#ffb74d',
  success: '#4caf50',
  info: '#5e9eff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: 14,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: 3,
  shadow: 'rgba(255, 255, 255, 0.024) 0px 0px 0px 1px inset',
};

/**
 * Linear Theme (Light)
 */
export const linearLight: ThemeConfiguration = {
  mode: 'light',
  primary: '#5e6ad2',
  secondary: '#6e7191',
  surface: '#ffffff',
  background: '#f7f8f9',
  text: '#161616',
  border: '#e4e5e7',
  error: '#e5484d',
  warning: '#f5a623',
  success: '#30a46c',
  info: '#5e6ad2',
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: 14,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: 8,
  shadow: '0 1px 2px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.06)',
};

/**
 * Linear Theme (Dark)
 */
export const linearDark: ThemeConfiguration = {
  mode: 'dark',
  primary: '#6e56cf',
  secondary: '#a8a29e',
  surface: '#1c1c1f',
  background: '#111113',
  text: '#ffffff',
  border: '#2d2d30',
  error: '#e5484d',
  warning: '#f5a623',
  success: '#46a758',
  info: '#6e56cf',
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: 14,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: 8,
  shadow: '0 0 0 1px rgba(255, 255, 255, 0.08)',
};

/**
 * High Contrast Theme
 */
export const highContrast: ThemeConfiguration = {
  mode: 'light',
  primary: '#0000ff',
  secondary: '#000000',
  surface: '#ffffff',
  background: '#ffffff',
  text: '#000000',
  border: '#000000',
  error: '#d90000',
  warning: '#d97706',
  success: '#008000',
  info: '#0000ff',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 16,
  spacing: { xs: 6, sm: 12, md: 20, lg: 28, xl: 36 },
  borderRadius: 0,
  shadow: '0 0 0 2px #000000',
};

/**
 * Available Themes
 */
export const themes = {
  default: defaultTheme,
  github: githubLight,
  githubLight,
  githubDark,
  vscode: vscodeLight,
  vscodeLight,
  vscodeDark,
  notion: notionLight,
  notionLight,
  notionDark,
  linear: linearLight,
  linearLight,
  linearDark,
  highContrast,
};
