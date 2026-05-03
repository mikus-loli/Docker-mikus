import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store';
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
            setLogs([{ type: 'system', data: 'Container not running. Start the service first.' }]);
            return;
        }

        setLogs([]);
        setIsStreaming(true);

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws?type=logs&container=${svc.containerId}&tail=${tailLines}&token=${token}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setLogs((prev) => [...prev, { type: 'system', data: `Connected to ${serviceName} logs...` }]);
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
                    setLogs((prev) => [...prev, { type: 'system', data: 'Log stream ended.' }]);
                }
            } catch {}
        };

        ws.onerror = () => {
            setIsStreaming(false);
            setLogs((prev) => [...prev, { type: 'error', data: 'Connection error' }]);
        };

        ws.onclose = () => {
            setIsStreaming(false);
        };
    }, [services, tailLines, token]);

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
                        <option value="">Select a service...</option>
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
                        <option value={50}>Last 50</option>
                        <option value={100}>Last 100</option>
                        <option value={200}>Last 200</option>
                        <option value={500}>Last 500</option>
                        <option value={1000}>Last 1000</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleToggleStream}
                        className={`btn-sm ${isStreaming ? 'btn-warning' : 'btn-success'}`}
                    >
                        {isStreaming ? (
                            <>
                                <Pause size={13} /> Pause
                            </>
                        ) : (
                            <>
                                <Play size={13} /> Stream
                            </>
                        )}
                    </button>
                    <button onClick={handleClear} className="btn-secondary btn-sm">
                        <Trash2 size={13} />
                        Clear
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-dark-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                            className="rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500/50"
                        />
                        Auto-scroll
                    </label>
                </div>
            </div>

            <div className="card overflow-hidden">
                <div className="bg-dark-800/50 px-4 py-2 border-b border-dark-700/50 flex items-center gap-2">
                    <Activity size={14} className={isStreaming ? 'text-emerald-400 animate-pulse' : 'text-dark-500'} />
                    <span className="text-xs text-dark-400">
                        {selectedSvc ? `${selectedSvc} - ${logs.length} lines` : 'No service selected'}
                    </span>
                </div>
                <div
                    className="bg-dark-950 p-4 font-mono text-xs leading-relaxed overflow-auto"
                    style={{ height: '500px' }}
                >
                    {logs.length === 0 ? (
                        <p className="text-dark-600">
                            {selectedSvc ? 'Waiting for logs...' : 'Select a service to view logs'}
                        </p>
                    ) : (
                        logs.map((log, i) => (
                            <div
                                key={i}
                                className={`whitespace-pre-wrap break-all ${
                                    log.type === 'stderr' || log.type === 'error'
                                        ? 'text-red-400'
                                        : log.type === 'system'
                                        ? 'text-dark-500 italic'
                                        : 'text-dark-200'
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
