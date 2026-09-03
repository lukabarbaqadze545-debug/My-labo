import { ka, type Dictionary } from './ka';
import { en } from './en';
import type { LocaleCode } from '@/content';

/**
 * Locale resolution.
 *
 * `dict()` returns a proxy-free deep merge of the requested locale over
 * Georgian, so a missing English key falls back to the Georgian string rather
 * than rendering an empty label or a key name.
 */

const locales: Record<LocaleCode, unknown> = { ka, en };

function deepMerge<T>(base: T, override: unknown): T {
  if (!override || typeof override !== 'object') return base;
  const result = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    const baseValue = result[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof baseValue === 'object' && baseValue) {
      result[key] = deepMerge(baseValue, value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

const cache = new Map<LocaleCode, Dictionary>();

export function dict(locale: LocaleCode = 'ka'): Dictionary {
  const cached = cache.get(locale);
  if (cached) return cached;
  const merged = locale === 'ka' ? ka : deepMerge(ka, locales[locale]);
  cache.set(locale, merged);
  return merged;
}

export { ka, en };
export type { Dictionary };

/** Difficulty label for a 1-5 value. */
export function difficultyLabel(level: number, d: Dictionary = ka): string {
  switch (level) {
    case 1:
      return d.common.difficulty1;
    case 2:
      return d.common.difficulty2;
    case 3:
      return d.common.difficulty3;
    case 4:
      return d.common.difficulty4;
    default:
      return d.common.difficulty5;
  }
}

/** Time-of-day greeting; Georgian has distinct forms worth honouring. */
export function greeting(d: Dictionary = ka, date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 11) return d.home.greetingMorning;
  if (hour < 18) return d.home.greetingDay;
  return d.home.greetingEvening;
}
