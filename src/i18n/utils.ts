import en from './en.json';
import hr from './hr.json';
import de from './de.json';
import si from './si.json';
import it from './it.json';
import pl from './pl.json';
import cz from './cz.json';

export const SUPPORTED_LANGS = ['en', 'hr', 'de', 'si', 'it', 'pl', 'cz'] as const;
export type SupportedLang = typeof SUPPORTED_LANGS[number];

// Maps project locale codes to BCP 47 / hreflang values
export const HREFLANG_MAP: Record<SupportedLang, string> = {
  en: 'en',
  hr: 'hr',
  de: 'de',
  si: 'sl', // ISO 639-1 for Slovenian
  it: 'it',
  pl: 'pl',
  cz: 'cs', // ISO 639-1 for Czech
};

// Maps project locale codes to Intl locale strings for date/number formatting
export const INTL_LOCALE_MAP: Record<SupportedLang, string> = {
  en: 'en-GB',
  hr: 'hr-HR',
  de: 'de-DE',
  si: 'sl-SI',
  it: 'it-IT',
  pl: 'pl-PL',
  cz: 'cs-CZ',
};

export type Translations = typeof en;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};

function deepMerge<T extends Record<string, unknown>>(base: T, override: DeepPartial<T>): T {
  const result = { ...base };
  for (const key in override) {
    const ov = override[key];
    const bv = base[key];
    // Skip null, undefined, and empty strings — these mean "not yet translated"
    if (ov !== undefined && ov !== null && ov !== '') {
      if (typeof ov === 'object' && !Array.isArray(ov) && typeof bv === 'object' && bv !== null) {
        result[key] = deepMerge(bv as Record<string, unknown>, ov as Record<string, unknown>) as T[typeof key];
      } else {
        result[key] = ov as T[typeof key];
      }
    }
  }
  return result;
}

const translations: Record<string, DeepPartial<Translations>> = { en, hr, de, si, it, pl, cz };

export function getTranslations(lang: string): Translations {
  const override = translations[lang] ?? {};
  return deepMerge(en, override as DeepPartial<Translations>);
}

/** Dot-notation key lookup with {{var}} interpolation. Returns the key itself if not found. */
export function t(dict: Translations, key: string, vars?: Record<string, string>): string {
  const parts = key.split('.');
  let node: unknown = dict;
  for (const p of parts) {
    if (typeof node !== 'object' || node === null) return key;
    node = (node as Record<string, unknown>)[p];
  }
  if (typeof node !== 'string') return key;
  if (!vars) return node;
  return node.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export function isSupportedLang(lang: string): lang is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(lang);
}
