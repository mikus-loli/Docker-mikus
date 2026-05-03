import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store';
import { useI18n } from '../i18n';
import { Terminal as TerminalIcon, Send, Trash2, XCircle } from 'lucide-react';

const MAX_OUTPUT_LINES = 3000;

export default function Terminal({ stackName }) {
    const [output, setOutput] = useState([]);
    const [command, setCommand] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const wsRef = useRef(null);
    const terminalRef = useRef(null);
    const token = useAuthStore((s) => s.token);
    const { t } = useI18n();

    const addOutput = useCallback((line) => {
        setOutput((prev) => {
            const next = [...prev, line];
            if (next.length > MAX_OUTPUT_LINES) {
                return next.slice(-2000);
            }
            return next;
        });
    }, []);

    const killProcess = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'kill' }));
        }
    }, []);

    const connectAndRun = useCallback((cmd) => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        addOutput({ type: 'input', data: `$ docker compose ${cmd}` });
        setIsRunning(true);

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws?type=terminal&stack=${stackName}&token=${token}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'command', command: cmd }));
            }
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'stdout' || msg.type === 'stderr') {
                    addOutput({ type: msg.type, data: msg.data });
                } else if (msg.type === 'error') {
                    addOutput({ type: 'error', data: msg.data });
                } else if (msg.type === 'exit') {
                    addOutput({
                        type: 'system',
                        data: t.terminal.processExited.replace('{code}', msg.code),
                    });
                    setIsRunning(false);
                    ws.close();
                    wsRef.current = null;
                }
            } catch {}
        };

        ws.onerror = () => {
            setIsRunning(false);
            addOutput({ type: 'error', data: t.terminal.connectionError });
            wsRef.current = null;
        };

        ws.onclose = () => {
            setIsRunning(false);
            wsRef.current = null;
        };
    }, [stackName, token, t, addOutput]);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [output]);

    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!command.trim() || isRunning) return;
        connectAndRun(command.trim());
        setCommand('');
    };

    const handlePreset = (cmd) => {
        if (isRunning) return;
        connectAndRun(cmd);
    };

    const handleClear = () => {
        setOutput([]);
    };

    const handleKill = () => {
        killProcess();
    };

    return (
        <div className="space-y-3">
            <div className="card overflow-hidden">
                <div className="bg-surface-200 dark:bg-surface-800 px-4 py-2 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TerminalIcon size={14} className={isRunning ? 'text-success animate-pulse' : 'text-text-muted'} />
                        <span className="text-xs text-text-muted">
                            docker compose [{stackName}]
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        {isRunning && (
                            <button onClick={handleKill} className="btn-ghost btn-sm text-danger hover:bg-danger-light" title={t.common.cancel}>
                                <XCircle size={12} />
                            </button>
                        )}
                        <button onClick={handleClear} className="btn-ghost btn-sm text-text-muted">
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
                <div
                    ref={terminalRef}
                    className="bg-surface-50 dark:bg-surface-950 p-4 font-mono text-xs leading-relaxed overflow-auto"
                    style={{ height: '400px' }}
                >
                    {output.length === 0 ? (
                        <p className="text-text-muted">
                            {t.terminal.waiting}
                        </p>
                    ) : (
                        output.map((line, i) => (
                            <div
                                key={i}
                                className={`whitespace-pre-wrap break-all ${
                                    line.type === 'input'
                                        ? 'text-primary-600 dark:text-primary-400 font-bold'
                                        : line.type === 'stderr'
                                        ? 'text-warning-dark dark:text-warning'
                                        : line.type === 'error'
                                        ? 'text-danger'
                                        : line.type === 'system'
                                        ? 'text-text-muted italic'
                                        : 'text-text-secondary'
                                }`}
                            >
                                {line.data}
                            </div>
                        ))
                    )}
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="border-t border-border flex items-center"
                >
                    <span className="text-primary-600 dark:text-primary-400 font-mono text-sm px-3">$</span>
                    <span className="text-text-muted font-mono text-xs">docker compose</span>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        className="flex-1 bg-transparent text-text-primary font-mono text-sm px-2 py-2.5 focus:outline-none"
                        placeholder={t.terminal.placeholder}
                        disabled={isRunning}
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={isRunning || !command.trim()}
                        className="px-3 py-2.5 text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                    >
                        <Send size={14} />
                    </button>
                </form>
            </div>
        </div>
    );
}
