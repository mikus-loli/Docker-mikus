import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStackStore, useSystemStore } from '../store';
import StackCard from '../components/StackCard';
import {
    Plus,
    RefreshCw,
    Search,
    LayoutGrid,
    List,
    Server,
    Cpu,
    HardDrive,
    Activity,
} from 'lucide-react';

export default function Dashboard() {
    const { stacks, fetchStacks, loading } = useStackStore();
    const { info, fetchSystemInfo } = useSystemStore();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState('grid');

    useEffect(() => {
        fetchStacks();
        fetchSystemInfo();
        const interval = setInterval(fetchStacks, 10000);
        return () => clearInterval(interval);
    }, [fetchStacks, fetchSystemInfo]);

    const filteredStacks = stacks.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    const runningStacks = stacks.filter((s) => s.status === 'running').length;
    const totalServices = stacks.reduce((acc, s) => acc + (s.serviceCount || 0), 0);
    const runningServices = stacks.reduce((acc, s) => acc + (s.runningCount || 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-dark-400 text-sm mt-1">Manage your Docker Compose stacks</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchStacks()}
                        className="btn-secondary btn-sm"
                        disabled={loading}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        onClick={() => navigate('/stack/new')}
                        className="btn-primary btn-sm"
                    >
                        <Plus size={14} />
                        New Stack
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500/15 rounded-lg flex items-center justify-center">
                            <LayoutGrid size={20} className="text-primary-400" />
                        </div>
                        <div>
                            <p className="text-dark-400 text-xs">Stacks</p>
                            <p className="text-xl font-bold text-white">{stacks.length}</p>
                        </div>
                    </div>
                </div>

                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/15 rounded-lg flex items-center justify-center">
                            <Activity size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-dark-400 text-xs">Running</p>
                            <p className="text-xl font-bold text-white">{runningStacks}</p>
                        </div>
                    </div>
                </div>

                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/15 rounded-lg flex items-center justify-center">
                            <Server size={20} className="text-purple-400" />
                        </div>
                        <div>
                            <p className="text-dark-400 text-xs">Services</p>
                            <p className="text-xl font-bold text-white">{runningServices}/{totalServices}</p>
                        </div>
                    </div>
                </div>

                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/15 rounded-lg flex items-center justify-center">
                            <Cpu size={20} className="text-amber-400" />
                        </div>
                        <div>
                            <p className="text-dark-400 text-xs">CPU Cores</p>
                            <p className="text-xl font-bold text-white">{info?.cpuCores || '-'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative flex-1 w-full">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search stacks..."
                        className="input pl-9"
                    />
                </div>
                <div className="flex items-center bg-dark-800 rounded-lg border border-dark-600 p-0.5">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-md transition-all ${
                            viewMode === 'grid'
                                ? 'bg-dark-600 text-white'
                                : 'text-dark-400 hover:text-white'
                        }`}
                    >
                        <LayoutGrid size={16} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-md transition-all ${
                            viewMode === 'list'
                                ? 'bg-dark-600 text-white'
                                : 'text-dark-400 hover:text-white'
                        }`}
                    >
                        <List size={16} />
                    </button>
                </div>
            </div>

            {filteredStacks.length === 0 ? (
                <div className="card p-12 text-center">
                    <div className="w-16 h-16 bg-dark-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <LayoutGrid size={28} className="text-dark-500" />
                    </div>
                    <h3 className="text-lg font-medium text-dark-300 mb-1">
                        {search ? 'No stacks found' : 'No stacks yet'}
                    </h3>
                    <p className="text-dark-500 text-sm mb-4">
                        {search
                            ? 'Try a different search term'
                            : 'Create your first Docker Compose stack'}
                    </p>
                    {!search && (
                        <button
                            onClick={() => navigate('/stack/new')}
                            className="btn-primary"
                        >
                            <Plus size={16} />
                            Create Stack
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
                    <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-dark-800/50 text-xs font-medium text-dark-400 uppercase tracking-wider border-b border-dark-700/50">
                        <div className="col-span-4">Name</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-2">Services</div>
                        <div className="col-span-2">Running</div>
                        <div className="col-span-2 text-right">Actions</div>
                    </div>
                    {filteredStacks.map((stack) => (
                        <StackCard key={stack.name} stack={stack} viewMode="list" />
                    ))}
                </div>
            )}
        </div>
    );
}
