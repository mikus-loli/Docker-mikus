import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore, useSystemStore } from '../store';
import { useEffect } from 'react';
import {
    LayoutDashboard,
    Plus,
    Settings,
    LogOut,
    Container,
    Server,
} from 'lucide-react';

export default function Layout() {
    const { user, logout } = useAuthStore();
    const { info, fetchSystemInfo } = useSystemStore();
    const navigate = useNavigate();

    useEffect(() => {
        fetchSystemInfo();
        const interval = setInterval(fetchSystemInfo, 30000);
        return () => clearInterval(interval);
    }, [fetchSystemInfo]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-dark-950 flex">
            <aside className="w-64 bg-dark-900 border-r border-dark-700/50 flex flex-col fixed h-full z-30 lg:relative">
                <div className="p-5 border-b border-dark-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/25">
                            <Container size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-tight">Mikus</h1>
                            <p className="text-[10px] text-dark-400 uppercase tracking-widest">Stack Manager</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-1">
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                isActive
                                    ? 'bg-primary-600/15 text-primary-400 border border-primary-500/30'
                                    : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                            }`
                        }
                    >
                        <LayoutDashboard size={18} />
                        Dashboard
                    </NavLink>

                    <NavLink
                        to="/stack/new"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                isActive
                                    ? 'bg-primary-600/15 text-primary-400 border border-primary-500/30'
                                    : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                            }`
                        }
                    >
                        <Plus size={18} />
                        New Stack
                    </NavLink>

                    <NavLink
                        to="/settings"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                isActive
                                    ? 'bg-primary-600/15 text-primary-400 border border-primary-500/30'
                                    : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                            }`
                        }
                    >
                        <Settings size={18} />
                        Settings
                    </NavLink>
                </nav>

                {info && (
                    <div className="p-4 border-t border-dark-700/50">
                        <div className="bg-dark-800/50 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2 text-dark-400 text-xs">
                                <Server size={12} />
                                <span>System</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-dark-500">Containers</span>
                                    <p className="text-white font-medium">{info.containersRunning || 0}/{info.containers || 0}</p>
                                </div>
                                <div>
                                    <span className="text-dark-500">Images</span>
                                    <p className="text-white font-medium">{info.images || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-3 border-t border-dark-700/50">
                    <div className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 bg-dark-700 rounded-full flex items-center justify-center text-xs font-bold text-dark-300 shrink-0">
                                {user?.username?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <span className="text-sm text-dark-300 truncate">{user?.username || 'admin'}</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="btn-icon text-dark-400 hover:text-red-400 hover:bg-red-500/10"
                            title="Logout"
                        >
                            <LogOut size={16} />
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
