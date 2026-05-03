import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { useTheme } from '../theme';
import { useI18n } from '../i18n';
import { Container, Sun, Moon, Languages } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login, loading, error } = useAuthStore();
    const { resolvedTheme, toggleTheme } = useTheme();
    const { t, language, toggleLanguage } = useI18n();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(username, password);
            navigate('/');
        } catch {}
    };

    return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="flex justify-end gap-2 mb-4">
                    <button
                        onClick={toggleTheme}
                        className="btn-icon text-text-muted hover:text-text-primary hover:bg-surface-200 dark:hover:bg-surface-700"
                        title={t.theme.toggle}
                    >
                        {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <button
                        onClick={toggleLanguage}
                        className="btn-icon text-text-muted hover:text-text-primary hover:bg-surface-200 dark:hover:bg-surface-700"
                        title={t.language.toggle}
                    >
                        <Languages size={18} />
                        <span className="text-xs ml-1">{language === 'zh' ? '中' : 'EN'}</span>
                    </button>
                </div>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-500/25">
                        <Container size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-text-primary mb-1">Mikus</h1>
                    <p className="text-text-muted">{t.auth.loginSubtitle}</p>
                </div>

                <div className="card p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-danger-light border border-danger/30 rounded-lg p-3 text-danger-dark dark:text-danger text-sm">
                                {t.auth.loginError}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                {t.common.username}
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="input"
                                placeholder={t.auth.usernamePlaceholder}
                                autoFocus
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                {t.common.password}
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input"
                                placeholder={t.auth.passwordPlaceholder}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-2.5"
                        >
                            {loading ? t.auth.signingIn : t.auth.signIn}
                        </button>
                    </form>
                </div>

                <p className="text-center text-text-muted text-xs mt-6">
                    {t.auth.defaultCredentials}
                </p>
            </div>
        </div>
    );
}
