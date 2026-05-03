import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStackStore, useSystemStore } from '../store';
import { useI18n } from '../i18n';
import StackCard from '../components/StackCard';
import {
    Plus,
    RefreshCw,
    Search,
    LayoutGrid,
    List,
    Server,
    Cpu,
    Activity,
} from 'lucide-react';

export default function Dashboard() {
    const { stacks, fetchStacks, loading } = useStackStore();
    const { info, fetchSystemInfo } = useSystemStore();
    const { t } = useI18n();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            await Promise.all([fetchStacks(), fetchSystemInfo()]);
            setInitialLoading(false);
        };
        load();
        const interval = setInterval(fetchStacks, 10000);
        return () => clearInterval(interval);
    }, [fetchStacks, fetchSystemInfo]);

    const filteredStacks = stacks.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    const runningStacks = stacks.filter((s) => s.status === 'running').length;
    const totalServices = stacks.reduce((acc, s) => acc + (s.serviceCount || 0), 0);
    const runningServices = stacks.reduce((acc, s) => acc + (s.runningCount || 0), 0);

    if (initialLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw size={24} className="animate-spin text-text-muted" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">{t.dashboard.title}</h1>
                    <p className="text-text-muted text-sm mt-1">{t.dashboard.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchStacks()}
                        className="btn-secondary btn-sm"
                        disabled={loading}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        {t.common.refresh}
                    </button>
                    <button
                        onClick={() => navigate('/stack/new')}
                        className="btn-primary btn-sm"
                    >
                        <Plus size={14} />
                        {t.dashboard.newStack}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-500/15 rounded-lg flex items-center justify-center">
                            <LayoutGrid size={20} className="text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <p className="text-text-muted text-xs">{t.dashboard.stacks}</p>
                            <p className="text-xl font-bold text-text-primary">{stacks.length}</p>
                        </div>
                    </div>
                </div>

                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-success-light rounded-lg flex items-center justify-center">
                            <Activity size={20} className="text-success-dark dark:text-success" />
                        </div>
                        <div>
                            <p className="text-text-muted text-xs">{t.dashboard.running}</p>
                            <p className="text-xl font-bold text-text-primary">{runningStacks}</p>
                        </div>
                    </div>
                </div>

                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/15 rounded-lg flex items-center justify-center">
                            <Server size={20} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-text-muted text-xs">{t.dashboard.services}</p>
                            <p className="text-xl font-bold text-text-primary">{runningServices}/{totalServices}</p>
                        </div>
                    </div>
                </div>

                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-warning-light rounded-lg flex items-center justify-center">
                            <Cpu size={20} className="text-warning-dark dark:text-warning" />
                        </div>
                        <div>
                            <p className="text-text-muted text-xs">{t.dashboard.cpuCores}</p>
                            <p className="text-xl font-bold text-text-primary">{info?.cpuCores || '-'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative flex-1 w-full">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t.dashboard.searchPlaceholder}
                        className="input pl-9"
                    />
                </div>
                <div className="flex items-center bg-surface-200 dark:bg-surface-800 rounded-lg border border-border p-0.5">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-md transition-all ${
                            viewMode === 'grid'
                                ? 'bg-surface-400 dark:bg-surface-600 text-text-primary'
                                : 'text-text-muted hover:text-text-primary'
                        }`}
                    >
                        <LayoutGrid size={16} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-md transition-all ${
                            viewMode === 'list'
                                ? 'bg-surface-400 dark:bg-surface-600 text-text-primary'
                                : 'text-text-muted hover:text-text-primary'
                        }`}
                    >
                        <List size={16} />
                    </button>
                </div>
            </div>

            {filteredStacks.length === 0 ? (
                <div className="card p-12 text-center">
                    <div className="w-16 h-16 bg-surface-200 dark:bg-surface-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <LayoutGrid size={28} className="text-text-muted" />
                    </div>
                    <h3 className="text-lg font-medium text-text-secondary mb-1">
                        {search ? t.dashboard.noResults : t.dashboard.noStacks}
                    </h3>
                    <p className="text-text-muted text-sm mb-4">
                        {search ? t.dashboard.noResultsDesc : t.dashboard.noStacksDesc}
                    </p>
                    {!search && (
                        <button
                            onClick={() => navigate('/stack/new')}
                            className="btn-primary"
                        >
                            <Plus size={16} />
                            {t.stack.createStack}
                        </button>
                    )}
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredStacks.map((stack) => (
                        <StackCard key={stack.name} stack={stack} />
                    ))}
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-surface-200 dark:bg-surface-800 text-xs font-medium text-text-muted uppercase tracking-wider border-b border-border">
                        <div className="col-span-4">{t.common.name}</div>
                        <div className="col-span-2">{t.common.status}</div>
                        <div className="col-span-2">{t.stack.serviceCount}</div>
                        <div className="col-span-2">{t.stack.runningCount}</div>
                        <div className="col-span-2 text-right">{t.common.actions}</div>
                    </div>
                    {filteredStacks.map((stack) => (
                        <StackCard key={stack.name} stack={stack} viewMode="list" />
                    ))}
                </div>
            )}
        </div>
    );
}
