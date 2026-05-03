import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translations, Language } from './translations';

type TranslationKeys = typeof translations.zh;

interface I18nContextType {
    language: Language;
    t: TranslationKeys;
    setLanguage: (lang: Language) => void;
    toggleLanguage: () => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

function getNestedValue(obj: any, path: string): string {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
            result = result[key];
        } else {
            return path;
        }
    }
    return typeof result === 'string' ? result : path;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>(() => {
        const saved = localStorage.getItem('mikus_language');
        if (saved === 'zh' || saved === 'en') return saved;
        const browserLang = navigator.language.toLowerCase();
        return browserLang.startsWith('zh') ? 'zh' : 'en';
    });

    const setLanguage = useCallback((lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('mikus_language', lang);
    }, []);

    const toggleLanguage = useCallback(() => {
        setLanguage(language === 'zh' ? 'en' : 'zh');
    }, [language, setLanguage]);

    const t = translations[language] as TranslationKeys;

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    return (
        <I18nContext.Provider value={{ language, t, setLanguage, toggleLanguage }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return context;
}

export function useTranslation() {
    const { t } = useI18n();
    return t;
}
