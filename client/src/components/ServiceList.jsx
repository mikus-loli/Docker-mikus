import {
    Play,
    Square,
    RotateCw,
    Activity,
    Container,
} from 'lucide-react';

const statusColors = {
    running: 'text-emerald-400',
    exited: 'text-red-400',
    paused: 'text-amber-400',
    restarting: 'text-amber-400',
    created: 'text-blue-400',
    dead: 'text-red-400',
    'not created': 'text-dark-500',
};

const statusDotColors = {
    running: 'bg-emerald-400',
    exited: 'bg-red-400',
    paused: 'bg-amber-400',
    restarting: 'bg-amber-400',
    created: 'bg-blue-400',
    dead: 'bg-red-400',
    'not created': 'bg-dark-600',
};

export default function ServiceList({ services, stackName, onServiceAction, onSelectService }) {
    if (!services || services.length === 0) {
        return (
            <div className="card p-8 text-center">
                <Container size={32} className="text-dark-600 mx-auto mb-3" />
                <p className="text-dark-400">No services found</p>
                <p className="text-dark-500 text-sm mt-1">Start the stack to see services</p>
            </div>
        );
    }

    return (
        <div className="card overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-dark-800/50 text-xs font-medium text-dark-400 uppercase tracking-wider border-b border-dark-700/50">
                <div className="col-span-3">Service</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Image</div>
                <div className="col-span-1">Ports</div>
                <div className="col-span-3 text-right">Actions</div>
            </div>
            <div className="divide-y divide-dark-700/30">
                {services.map((svc) => (
                    <div
                        key={svc.name}
                        className="grid grid-cols-12 gap-4 px-5 py-3 items-center hover:bg-dark-800/30 transition-colors"
                    >
                        <div className="col-span-3 flex items-center gap-2.5">
                            <span className={`w-2 h-2 rounded-full ${statusDotColors[svc.status] || 'bg-dark-600'}`} />
                            <span className="text-white font-medium text-sm">{svc.name}</span>
                        </div>
                        <div className="col-span-2">
                            <span className={`text-sm ${statusColors[svc.status] || 'text-dark-400'}`}>
                                {svc.status}
                            </span>
                        </div>
                        <div className="col-span-3 text-dark-400 text-sm font-mono truncate">
                            {svc.image}
                        </div>
                        <div className="col-span-1 text-dark-400 text-xs">
                            {svc.ports?.length || 0}
                        </div>
                        <div className="col-span-3 flex items-center justify-end gap-1.5">
                            {svc.status === 'running' ? (
                                <>
                                    <button
                                        onClick={() => onServiceAction('stop', svc.name)}
                                        className="btn-icon text-dark-400 hover:text-red-400 hover:bg-red-500/10"
                                        title="Stop"
                                    >
                                        <Square size={14} />
                                    </button>
                                    <button
                                        onClick={() => onServiceAction('restart', svc.name)}
                                        className="btn-icon text-dark-400 hover:text-amber-400 hover:bg-amber-500/10"
                                        title="Restart"
                                    >
                                        <RotateCw size={14} />
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => onServiceAction('start', svc.name)}
                                    className="btn-icon text-dark-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                                    title="Start"
                                >
                                    <Play size={14} />
                                </button>
                            )}
                            {svc.containerId && (
                                <button
                                    onClick={() => onSelectService(svc)}
                                    className="btn-icon text-dark-400 hover:text-primary-400 hover:bg-primary-500/10"
                                    title="View Logs"
                                >
                                    <Activity size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
