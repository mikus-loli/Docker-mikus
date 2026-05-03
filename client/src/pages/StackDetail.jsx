import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStackStore } from '../store';
import { useI18n } from '../i18n';
import ComposeEditor from '../components/ComposeEditor';
import ServiceList from '../components/ServiceList';
import LogViewer from '../components/LogViewer';
import Terminal from '../components/Terminal';
import {
    ArrowLeft,
    Play,
    Square,
    RotateCw,
    Download,
    Trash2,
    RefreshCw,
    Terminal as TerminalIcon,
    FileCode,
    Server,
    Activity,
    AlertTriangle,
} from 'lucide-react';

const TABS = [
    { id: 'services', labelKey: 'stack.services', icon: Server },
    { id: 'editor', labelKey: 'stack.editor', icon: FileCode },
    { id: 'logs', labelKey: 'stack.logs', icon: Activity },
    { id: 'terminal', labelKey: 'stack.terminal', icon: TerminalIcon },
];

export default function StackDetail() {
    const { name } = useParams();
    const navigate = useNavigate();
    const { fetchStack, currentStack, stackAction, deleteStack, getStackCompose, getStackServices, loading } = useStackStore();
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState('services');
    const [actionLoading, setActionLoading] = useState(null);
    const [services, setServices] = useState([]);
    const [selectedService, setSelectedService] = useState(null);
    const [composeData, setComposeData] = useState(null);
    const [error, setError] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const pollRef = useRef(null);

    const loadStack = useCallback(async () => {
        try {
            await fetchStack(name);
            const svcs = await getStackServices(name);
            setServices(svcs);
        } catch (err) {
            setError(err.message);
        }
    }, [name, fetchStack, getStackServices]);

    useEffect(() => {
        loadStack();
        pollRef.current = setInterval(loadStack, 15000);
        return () => clearInterval(pollRef.current);
    }, [loadStack]);

    const handleAction = async (action, service = null) => {
        setActionLoading(action);
        setError(null);
        try {
            await stackAction(name, action, service);
            setTimeout(loadStack, 1000);
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteStack(name);
            navigate('/');
        } catch (err) {
            setError(err.message);
        }
    };

    const handleLoadCompose = async () => {
        try {
            const data = await getStackCompose(name);
            setComposeData(data);
        } catch (err) {
            setError(err.message);
        }
    };

    const stack = currentStack;

    if (!stack && loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw size={24} className="animate-spin text-text-muted" />
            </div>
        );
    }

    if (!stack) {
        return (
            <div className="text-center py-12">
                <p className="text-text-muted">{t.stack.stackNotFound}</p>
                <button onClick={() => navigate('/')} className="btn-primary mt-4">
                    {t.dashboard.title}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="btn-ghost text-text-muted">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-text-primary">{stack.name}</h1>
                            <StatusBadge status={stack.status} />
                        </div>
                        <p className="text-text-muted text-sm mt-0.5">
                            {stack.runningCount || 0} / {stack.serviceCount || 0} {t.stack.services}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => handleAction('up')}
                        disabled={actionLoading === 'up'}
                        className="btn-success btn-sm"
                    >
                        <Play size={14} />
                        {actionLoading === 'up' ? t.stack.starting : t.stack.start}
                    </button>
                    <button
                        onClick={() => handleAction('down')}
                        disabled={actionLoading === 'down'}
                        className="btn-danger btn-sm"
                    >
                        <Square size={14} />
                        {actionLoading === 'down' ? t.stack.stopping : t.stack.stop}
                    </button>
                    <button
                        onClick={() => handleAction('restart')}
                        disabled={actionLoading === 'restart'}
                        className="btn-warning btn-sm"
                    >
                        <RotateCw size={14} className={actionLoading === 'restart' ? 'animate-spin' : ''} />
                        {t.stack.restart}
                    </button>
                    <button
                        onClick={() => handleAction('pull')}
                        disabled={actionLoading === 'pull'}
                        className="btn-secondary btn-sm"
                    >
                        <Download size={14} />
                        {t.stack.pull}
                    </button>
                    <button
                        onClick={() => loadStack()}
                        className="btn-ghost btn-sm"
                        disabled={loading}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                            className="btn-ghost btn-sm text-danger hover:bg-danger-light"
                        >
                            <Trash2 size={14} />
                        </button>
                        {showDeleteConfirm && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border rounded-xl p-4 shadow-xl z-50">
                                <div className="flex items-center gap-2 text-danger mb-2">
                                    <AlertTriangle size={16} />
                                    <span className="font-medium text-sm">{t.stack.deleteStack}</span>
                                </div>
                                <p className="text-text-muted text-xs mb-3">
                                    {t.stack.deleteWarning}
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={handleDelete} className="btn-danger btn-sm flex-1">
                                        {t.common.delete}
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="btn-secondary btn-sm flex-1"
                                    >
                                        {t.common.cancel}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-danger-light border border-danger/30 rounded-lg p-3 text-danger-dark dark:text-danger text-sm">
                    {error}
                </div>
            )}

            <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-lg border border-border overflow-x-auto">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id);
                            if (tab.id === 'editor') handleLoadCompose();
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'bg-surface-300 dark:bg-surface-600 text-text-primary'
                                : 'text-text-muted hover:text-text-primary hover:bg-surface-200 dark:hover:bg-surface-700'
                        }`}
                    >
                        <tab.icon size={15} />
                        {tab.labelKey.split('.').reduce((obj, key) => obj?.[key], t)}
                    </button>
                ))}
            </div>

            <div>
                {activeTab === 'services' && (
                    <ServiceList
                        services={services}
                        stackName={name}
                        onServiceAction={handleAction}
                        onSelectService={(svc) => {
                            setSelectedService(svc);
                            setActiveTab('logs');
                        }}
                    />
                )}

                {activeTab === 'editor' && (
                    <ComposeEditor
                        stackName={name}
                        composeData={composeData}
                        onLoad={handleLoadCompose}
                    />
                )}

                {activeTab === 'logs' && (
                    <LogViewer
                        stackName={name}
                        services={services}
                        selectedService={selectedService}
                    />
                )}

                {activeTab === 'terminal' && (
                    <Terminal stackName={name} />
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const { t } = useI18n();
    const config = {
        running: { class: 'badge-running', dot: 'status-dot-running', labelKey: 'common.running' },
        partial: { class: 'badge-partial', dot: 'status-dot-partial', labelKey: 'common.partial' },
        stopped: { class: 'badge-stopped', dot: 'status-dot-stopped', labelKey: 'common.stopped' },
        inactive: { class: 'badge-inactive', dot: 'status-dot-inactive', labelKey: 'common.inactive' },
        error: { class: 'badge-error', dot: 'status-dot-stopped', labelKey: 'common.error' },
        invalid: { class: 'badge-error', dot: 'status-dot-stopped', labelKey: 'common.invalid' },
    };
    const c = config[status] || config.inactive;
    const label = c.labelKey.split('.').reduce((obj, key) => obj?.[key], t);
    return (
        <span className={c.class}>
            <span className={c.dot + ' mr-1.5'} />
            {label}
        </span>
    );
}
