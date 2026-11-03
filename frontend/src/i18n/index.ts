import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import fr from './fr';

export type Language = 'en' | 'fr';
export const LANGUAGES: Language[] = ['en', 'fr'];
const STORAGE_KEY = 'app_language';

/** Last language used on this device, so the login page already speaks the user's language. */
export const storedLanguage = (): Language => {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return v === 'fr' ? 'fr' : 'en';
};

export const setLanguage = (lang: string | null | undefined) => {
  const next: Language = lang === 'fr' ? 'fr' : 'en';
  localStorage.setItem(STORAGE_KEY, next);
  if (i18n.language !== next) i18n.changeLanguage(next);
};

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: storedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
