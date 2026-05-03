import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore, useSystemStore } from '../store';
import { useTheme } from '../theme';
import { useI18n } from '../i18n';
import { useEffect } from 'react';
import {
    LayoutDashboard,
    Plus,
    Settings,
    LogOut,
    Container,
    Server,
    Sun,
    Moon,
    Languages,
} from 'lucide-react';

export default function Layout() {
    const { user, logout } = useAuthStore();
    const { info, fetchSystemInfo } = useSystemStore();
    const { resolvedTheme, toggleTheme } = useTheme();
    const { t, language, toggleLanguage } = useI18n();
    const navigate = useNavigate();

    useEffect(() => {
        fetchSystemInfo();
        const interval = setInterval(fetchSystemInfo, 30000);
        return () => clearInterval(interval);
    }, [fetchSystemInfo]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-surface flex">
            <aside className="w-64 sidebar flex flex-col h-screen sticky top-0">
                <div className="p-5 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/25">
                            <Container size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-text-primary tracking-tight">Mikus</h1>
                            <p className="text-[10px] text-text-muted uppercase tracking-widest">{t.auth.loginSubtitle}</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-1">
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) =>
                            `sidebar-item ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}`
                        }
                    >
                        <LayoutDashboard size={18} />
                        {t.dashboard.title}
                    </NavLink>

                    <NavLink
                        to="/stack/new"
                        className={({ isActive }) =>
                            `sidebar-item ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}`
                        }
                    >
                        <Plus size={18} />
                        {t.stack.newStack}
                    </NavLink>

                    <NavLink
                        to="/settings"
                        className={({ isActive }) =>
                            `sidebar-item ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}`
                        }
                    >
                        <Settings size={18} />
                        {t.common.settings}
                    </NavLink>
                </nav>

                {info && (
                    <div className="p-4 border-t border-border">
                        <div className="bg-surface-100 dark:bg-surface-800 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2 text-text-muted text-xs">
                                <Server size={12} />
                                <span>Docker</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-text-muted">{t.settings.containers}</span>
                                    <p className="text-text-primary font-medium">{info.containersRunning || 0}/{info.containers || 0}</p>
                                </div>
                                <div>
                                    <span className="text-text-muted">{t.settings.images}</span>
                                    <p className="text-text-primary font-medium">{info.images || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-3 border-t border-border">
                    <div className="flex items-center justify-between px-1 py-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 bg-surface-300 dark:bg-surface-600 rounded-full flex items-center justify-center text-xs font-bold text-text-secondary shrink-0">
                                {user?.username?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <span className="text-sm text-text-secondary truncate">{user?.username || 'admin'}</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="btn-icon text-text-muted hover:text-danger hover:bg-danger-light"
                            title={t.common.logout}
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTheme}
                            className="btn-icon text-text-muted hover:text-text-primary hover:bg-surface-200 dark:hover:bg-surface-700 flex-1 justify-center"
                            title={t.theme.toggle}
                        >
                            {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                        <button
                            onClick={toggleLanguage}
                            className="btn-icon text-text-muted hover:text-text-primary hover:bg-surface-200 dark:hover:bg-surface-700 flex-1 inline-flex items-center justify-center"
                            title={t.language.toggle}
                        >
                            <Languages size={16} />
                            <span className="text-xs ml-1">{language === 'zh' ? '中' : 'EN'}</span>
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 min-h-screen overflow-auto">
                <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
