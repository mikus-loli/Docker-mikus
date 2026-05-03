import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store';
import { useI18n } from '../i18n';
import { Activity, Trash2, Pause, Play } from 'lucide-react';

export default function LogViewer({ stackName, services, selectedService }) {
    const [logs, setLogs] = useState([]);
    const [selectedSvc, setSelectedSvc] = useState(selectedService?.name || '');
    const [autoScroll, setAutoScroll] = useState(true);
    const [isStreaming, setIsStreaming] = useState(false);
    const [tailLines, setTailLines] = useState(200);
    const logsEndRef = useRef(null);
    const wsRef = useRef(null);
    const token = useAuthStore((s) => s.token);
    const { t } = useI18n();

    const runningServices = services.filter((s) => s.containerId);

    useEffect(() => {
        setSelectedSvc(selectedService?.name || '');
    }, [selectedService]);

    const connectWebSocket = useCallback((serviceName) => {
        if (wsRef.current) {
            wsRef.current.close();
        }

        const svc = services.find((s) => s.name === serviceName);
        if (!svc?.containerId) {
            setLogs([{ type: 'system', data: t.logs.containerNotRunning }]);
            return;
        }

        setLogs([]);
        setIsStreaming(true);

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws?type=logs&container=${svc.containerId}&tail=${tailLines}&token=${token}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setLogs((prev) => [...prev, { type: 'system', data: t.logs.connected }]);
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'stdout' || msg.type === 'stderr') {
                    setLogs((prev) => {
                        const newLogs = [...prev, { type: msg.type, data: msg.data }];
                        if (newLogs.length > 5000) {
                            return newLogs.slice(-3000);
                        }
                        return newLogs;
                    });
                } else if (msg.type === 'error') {
                    setLogs((prev) => [...prev, { type: 'error', data: msg.data }]);
                } else if (msg.type === 'end') {
                    setIsStreaming(false);
                    setLogs((prev) => [...prev, { type: 'system', data: t.logs.disconnected }]);
                }
            } catch {}
        };

        ws.onerror = () => {
            setIsStreaming(false);
            setLogs((prev) => [...prev, { type: 'error', data: t.logs.connectionError }]);
        };

        ws.onclose = () => {
            setIsStreaming(false);
        };
    }, [services, tailLines, token, t]);

    useEffect(() => {
        if (selectedSvc) {
            connectWebSocket(selectedSvc);
        }
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [selectedSvc, connectWebSocket]);

    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const handleClear = () => {
        setLogs([]);
    };

    const handleToggleStream = () => {
        if (isStreaming) {
            if (wsRef.current) {
                wsRef.current.close();
            }
            setIsStreaming(false);
        } else if (selectedSvc) {
            connectWebSocket(selectedSvc);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={selectedSvc}
                        onChange={(e) => setSelectedSvc(e.target.value)}
                        className="input max-w-xs text-sm"
                    >
                        <option value="">{t.logs.selectService}</option>
                        {runningServices.map((svc) => (
                            <option key={svc.name} value={svc.name}>
                                {svc.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={tailLines}
                        onChange={(e) => setTailLines(parseInt(e.target.value))}
                        className="input max-w-[120px] text-sm"
                    >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                        <option value={500}>500</option>
                        <option value={1000}>1000</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleToggleStream}
                        className={`btn-sm ${isStreaming ? 'btn-warning' : 'btn-success'}`}
                    >
                        {isStreaming ? (
                            <>
                                <Pause size={13} /> {t.logs.pause}
                            </>
                        ) : (
                            <>
                                <Play size={13} /> {t.logs.stream}
                            </>
                        )}
                    </button>
                    <button onClick={handleClear} className="btn-secondary btn-sm">
                        <Trash2 size={13} />
                        {t.common.clear}
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                            className="rounded border-border bg-surface-100 dark:bg-surface-800 text-primary-500 focus:ring-primary-500/50"
                        />
                        {t.logs.autoScroll}
                    </label>
                </div>
            </div>

            <div className="card overflow-hidden">
                <div className="bg-surface-200 dark:bg-surface-800 px-4 py-2 border-b border-border flex items-center gap-2">
                    <Activity size={14} className={isStreaming ? 'text-success animate-pulse' : 'text-text-muted'} />
                    <span className="text-xs text-text-muted">
                        {selectedSvc ? `${selectedSvc} - ${logs.length} ${t.stack.services}` : t.logs.selectServiceHint}
                    </span>
                </div>
                <div
                    className="bg-surface-50 dark:bg-surface-950 p-4 font-mono text-xs leading-relaxed overflow-auto"
                    style={{ height: '500px' }}
                >
                    {logs.length === 0 ? (
                        <p className="text-text-muted">
                            {selectedSvc ? t.logs.waiting : t.logs.selectServiceHint}
                        </p>
                    ) : (
                        logs.map((log, i) => (
                            <div
                                key={i}
                                className={`whitespace-pre-wrap break-all ${
                                    log.type === 'stderr' || log.type === 'error'
                                        ? 'text-danger'
                                        : log.type === 'system'
                                        ? 'text-text-muted italic'
                                        : 'text-text-secondary'
                                }`}
                            >
                                {log.data}
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
}
