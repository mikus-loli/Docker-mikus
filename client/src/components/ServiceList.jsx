import { useI18n } from '../i18n';
import {
    Play,
    Square,
    RotateCw,
    Activity,
    Container,
} from 'lucide-react';

const statusColors = {
    running: 'text-success-dark dark:text-success',
    exited: 'text-danger-dark dark:text-danger',
    paused: 'text-warning-dark dark:text-warning',
    restarting: 'text-warning-dark dark:text-warning',
    created: 'text-primary-600 dark:text-primary-400',
    dead: 'text-danger-dark dark:text-danger',
    'not created': 'text-text-muted',
};

const statusDotColors = {
    running: 'bg-success',
    exited: 'bg-danger',
    paused: 'bg-warning',
    restarting: 'bg-warning',
    created: 'bg-primary-500',
    dead: 'bg-danger',
    'not created': 'bg-surface-400',
};

const statusLabelKeys = {
    running: 'common.running',
    exited: 'common.stopped',
    paused: 'common.paused',
    restarting: 'common.running',
    created: 'common.enabled',
    dead: 'common.error',
    'not created': 'service.notCreated',
};

export default function ServiceList({ services, stackName, onServiceAction, onSelectService }) {
    const { t } = useI18n();

    if (!services || services.length === 0) {
        return (
            <div className="card p-8 text-center">
                <Container size={32} className="text-text-muted mx-auto mb-3" />
                <p className="text-text-secondary">{t.stack.noServices}</p>
                <p className="text-text-muted text-sm mt-1">{t.stack.noServicesDesc}</p>
            </div>
        );
    }

    return (
        <div className="card overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-surface-200 dark:bg-surface-800 text-xs font-medium text-text-muted uppercase tracking-wider border-b border-border">
                <div className="col-span-3">{t.service.title}</div>
                <div className="col-span-2">{t.common.status}</div>
                <div className="col-span-3">{t.service.image}</div>
                <div className="col-span-1">{t.service.ports}</div>
                <div className="col-span-3 text-right">{t.common.actions}</div>
            </div>
            <div className="divide-y divide-border">
                {services.map((svc) => {
                    const statusColor = statusColors[svc.status] || 'text-text-muted';
                    const dotColor = statusDotColors[svc.status] || 'bg-surface-400';
                    const labelKey = statusLabelKeys[svc.status] || 'common.unknown';
                    const statusLabel = labelKey.split('.').reduce((obj, key) => obj?.[key], t);

                    return (
                        <div
                            key={svc.name}
                            className="grid grid-cols-12 gap-4 px-5 py-3 items-center hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                        >
                            <div className="col-span-3 flex items-center gap-2.5">
                                <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                <span className="text-text-primary font-medium text-sm">{svc.name}</span>
                            </div>
                            <div className="col-span-2">
                                <span className={`text-sm ${statusColor}`}>
                                    {statusLabel}
                                </span>
                            </div>
                            <div className="col-span-3 text-text-muted text-sm font-mono truncate">
                                {svc.image}
                            </div>
                            <div className="col-span-1 text-text-muted text-xs">
                                {svc.ports?.length || 0}
                            </div>
                            <div className="col-span-3 flex items-center justify-end gap-1.5">
                                {svc.status === 'running' ? (
                                    <>
                                        <button
                                            onClick={() => onServiceAction('stop', svc.name)}
                                            className="btn-icon text-text-muted hover:text-danger hover:bg-danger-light"
                                            title={t.service.stop}
                                        >
                                            <Square size={14} />
                                        </button>
                                        <button
                                            onClick={() => onServiceAction('restart', svc.name)}
                                            className="btn-icon text-text-muted hover:text-warning-dark dark:hover:text-warning hover:bg-warning-light"
                                            title={t.service.restart}
                                        >
                                            <RotateCw size={14} />
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => onServiceAction('start', svc.name)}
                                        className="btn-icon text-text-muted hover:text-success-dark dark:hover:text-success hover:bg-success-light"
                                        title={t.service.start}
                                    >
                                        <Play size={14} />
                                    </button>
                                )}
                                {svc.containerId && (
                                    <button
                                        onClick={() => onSelectService(svc)}
                                        className="btn-icon text-text-muted hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/15"
                                        title={t.service.viewLogs}
                                    >
                                        <Activity size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
