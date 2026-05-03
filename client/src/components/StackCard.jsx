import { useNavigate } from 'react-router-dom';
import {
    Play,
    Square,
    RotateCw,
    ChevronRight,
    Container,
} from 'lucide-react';
import { useI18n } from '../i18n';

const statusConfig = {
    running: { badge: 'badge-running', dot: 'status-dot-running', labelKey: 'common.running' },
    partial: { badge: 'badge-partial', dot: 'status-dot-partial', labelKey: 'common.partial' },
    stopped: { badge: 'badge-stopped', dot: 'status-dot-stopped', labelKey: 'common.stopped' },
    inactive: { badge: 'badge-inactive', dot: 'status-dot-inactive', labelKey: 'common.inactive' },
    error: { badge: 'badge-error', dot: 'status-dot-stopped', labelKey: 'common.error' },
    invalid: { badge: 'badge-error', dot: 'status-dot-stopped', labelKey: 'common.invalid' },
};

export default function StackCard({ stack, viewMode = 'grid' }) {
    const navigate = useNavigate();
    const { t } = useI18n();
    const config = statusConfig[stack.status] || statusConfig.inactive;
    const statusLabel = config.labelKey.split('.').reduce((obj, key) => obj?.[key], t);

    if (viewMode === 'list') {
        return (
            <div
                className="grid grid-cols-12 gap-4 px-4 py-3 items-center border-b border-border hover:bg-surface-100 dark:hover:bg-surface-800 transition-all cursor-pointer"
                onClick={() => navigate(`/stack/${stack.name}`)}
            >
                <div className="col-span-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-surface-200 dark:bg-surface-700 rounded-lg flex items-center justify-center">
                        <Container size={16} className="text-primary-600 dark:text-primary-400" />
                    </div>
                    <span className="text-text-primary font-medium text-sm">{stack.name}</span>
                </div>
                <div className="col-span-2">
                    <span className={config.badge}>
                        <span className={config.dot + ' mr-1.5'} />
                        {statusLabel}
                    </span>
                </div>
                <div className="col-span-2 text-text-secondary text-sm">{stack.serviceCount || 0}</div>
                <div className="col-span-2 text-text-secondary text-sm">{stack.runningCount || 0}</div>
                <div className="col-span-2 flex justify-end">
                    <ChevronRight size={16} className="text-text-muted" />
                </div>
            </div>
        );
    }

    return (
        <div
            className="card-hover p-5 cursor-pointer group"
            onClick={() => navigate(`/stack/${stack.name}`)}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-purple-100 dark:from-primary-500/20 dark:to-purple-500/20 rounded-xl flex items-center justify-center border border-primary-200 dark:border-primary-500/20">
                        <Container size={20} className="text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                        <h3 className="text-text-primary font-semibold text-sm">{stack.name}</h3>
                        <span className={config.badge + ' mt-1'}>
                            <span className={config.dot + ' mr-1'} />
                            {statusLabel}
                        </span>
                    </div>
                </div>
                <ChevronRight
                    size={16}
                    className="text-text-muted group-hover:text-text-secondary transition-colors mt-1"
                />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-surface-100 dark:bg-surface-800 rounded-lg p-2.5">
                    <p className="text-text-muted text-xs">{t.stack.serviceCount}</p>
                    <p className="text-text-primary font-semibold text-lg">{stack.serviceCount || 0}</p>
                </div>
                <div className="bg-surface-100 dark:bg-surface-800 rounded-lg p-2.5">
                    <p className="text-text-muted text-xs">{t.stack.runningCount}</p>
                    <p className="text-text-primary font-semibold text-lg">{stack.runningCount || 0}</p>
                </div>
            </div>

            {stack.services && stack.services.length > 0 && (
                <div className="space-y-1.5">
                    {stack.services.slice(0, 4).map((svc) => {
                        const svcConfig = statusConfig[svc.status] || statusConfig.inactive;
                        return (
                            <div
                                key={svc.name}
                                className="flex items-center justify-between text-xs py-1"
                            >
                                <span className="text-text-secondary">{svc.name}</span>
                                <span className={svcConfig.dot} />
                            </div>
                        );
                    })}
                    {stack.services.length > 4 && (
                        <p className="text-text-muted text-xs">
                            +{stack.services.length - 4} more
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
