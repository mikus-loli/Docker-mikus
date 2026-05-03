import { useNavigate } from 'react-router-dom';
import {
    Play,
    Square,
    RotateCw,
    Trash2,
    ChevronRight,
    Container,
} from 'lucide-react';

const statusConfig = {
    running: { badge: 'badge-running', dot: 'status-dot-running', label: 'Running' },
    partial: { badge: 'badge-partial', dot: 'status-dot-partial', label: 'Partial' },
    stopped: { badge: 'badge-stopped', dot: 'status-dot-stopped', label: 'Stopped' },
    inactive: { badge: 'badge-inactive', dot: 'status-dot-inactive', label: 'Inactive' },
    error: { badge: 'badge-error', dot: 'status-dot-stopped', label: 'Error' },
    invalid: { badge: 'badge-error', dot: 'status-dot-stopped', label: 'Invalid' },
};

export default function StackCard({ stack, viewMode = 'grid' }) {
    const navigate = useNavigate();
    const config = statusConfig[stack.status] || statusConfig.inactive;

    if (viewMode === 'list') {
        return (
            <div
                className="grid grid-cols-12 gap-4 px-4 py-3 items-center border-b border-dark-700/30 hover:bg-dark-800/50 transition-all cursor-pointer"
                onClick={() => navigate(`/stack/${stack.name}`)}
            >
                <div className="col-span-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-dark-800 rounded-lg flex items-center justify-center">
                        <Container size={16} className="text-primary-400" />
                    </div>
                    <span className="text-white font-medium text-sm">{stack.name}</span>
                </div>
                <div className="col-span-2">
                    <span className={config.badge}>
                        <span className={config.dot + ' mr-1.5'} />
                        {config.label}
                    </span>
                </div>
                <div className="col-span-2 text-dark-300 text-sm">{stack.serviceCount || 0}</div>
                <div className="col-span-2 text-dark-300 text-sm">{stack.runningCount || 0}</div>
                <div className="col-span-2 flex justify-end">
                    <ChevronRight size={16} className="text-dark-500" />
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
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500/20 to-purple-500/20 rounded-xl flex items-center justify-center border border-primary-500/20">
                        <Container size={20} className="text-primary-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-semibold text-sm">{stack.name}</h3>
                        <span className={config.badge + ' mt-1'}>
                            <span className={config.dot + ' mr-1'} />
                            {config.label}
                        </span>
                    </div>
                </div>
                <ChevronRight
                    size={16}
                    className="text-dark-600 group-hover:text-dark-400 transition-colors mt-1"
                />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-dark-800/50 rounded-lg p-2.5">
                    <p className="text-dark-500 text-xs">Services</p>
                    <p className="text-white font-semibold text-lg">{stack.serviceCount || 0}</p>
                </div>
                <div className="bg-dark-800/50 rounded-lg p-2.5">
                    <p className="text-dark-500 text-xs">Running</p>
                    <p className="text-white font-semibold text-lg">{stack.runningCount || 0}</p>
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
                                <span className="text-dark-300">{svc.name}</span>
                                <span className={svcConfig.dot} />
                            </div>
                        );
                    })}
                    {stack.services.length > 4 && (
                        <p className="text-dark-500 text-xs">
                            +{stack.services.length - 4} more services
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
