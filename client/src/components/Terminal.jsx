import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store';
import { useI18n } from '../i18n';
import { Terminal as TerminalIcon, Send, Trash2, XCircle, Monitor } from 'lucide-react';

const MAX_OUTPUT_LINES = 3000;

export default function Terminal({ stackName, container }) {
    const [output, setOutput] = useState([]);
    const [command, setCommand] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [connected, setConnected] = useState(false);
    const [mode, setMode] = useState(container ? 'container' : 'compose');
    const wsRef = useRef(null);
    const terminalRef = useRef(null);
    const inputRef = useRef(null);
    const token = useAuthStore((s) => s.token);
    const { t } = useI18n();
    const pingRef = useRef(null);

    const addOutput = useCallback((line) => {
        setOutput((prev) => {
            const next = [...prev, line];
            if (next.length > MAX_OUTPUT_LINES) {
                return next.slice(-2000);
            }
            return next;
        });
    }, []);

    const connect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let wsUrl = `${wsProtocol}//${window.location.host}/ws?type=terminal&stack=${stackName}&token=${token}`;

        if (mode === 'container' && container?.containerId) {
            wsUrl = `${wsProtocol}//${window.location.host}/ws?type=terminal&container=${container.containerId}&shell=/bin/sh&token=${token}`;
        }

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {};

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'ready') {
                    setConnected(true);
                    if (msg.mode === 'container') {
                        addOutput({ type: 'system', data: `Connected to ${container?.name || msg.containerId} (${msg.shell})` });
                    }
                } else if (msg.type === 'running') {
                    setIsRunning(true);
                    addOutput({ type: 'input', data: `$ docker compose ${msg.command}` });
                } else if (msg.type === 'stdout' || msg.type === 'stderr') {
                    addOutput({ type: msg.type, data: msg.data });
                } else if (msg.type === 'error') {
                    addOutput({ type: 'error', data: msg.data });
                } else if (msg.type === 'done') {
                    if (mode === 'compose') {
                        addOutput({
                            type: 'system',
                            data: t.terminal.processExited.replace('{code}', msg.code),
                        });
                        setIsRunning(false);
                    } else {
                        addOutput({ type: 'system', data: 'Session ended.' });
                        setConnected(false);
                    }
                }
            } catch {}
        };

        ws.onerror = () => {
            setConnected(false);
            setIsRunning(false);
            addOutput({ type: 'error', data: t.terminal.connectionError });
        };

        ws.onclose = () => {
            setConnected(false);
            setIsRunning(false);
            wsRef.current = null;
            if (pingRef.current) {
                clearInterval(pingRef.current);
                pingRef.current = null;
            }
        };

        pingRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    }, [stackName, token, mode, container, addOutput, t]);

    useEffect(() => {
        connect();
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            if (pingRef.current) {
                clearInterval(pingRef.current);
                pingRef.current = null;
            }
        };
    }, [connect]);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [output]);

    useEffect(() => {
        if (mode === 'container' && connected && inputRef.current) {
            inputRef.current.focus();
        }
    }, [mode, connected]);

    const sendCommand = useCallback((cmd) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            addOutput({ type: 'error', data: t.terminal.connectionError });
            connect();
            return;
        }
        ws.send(JSON.stringify({ type: 'command', command: cmd }));
    }, [connect, addOutput, t]);

    const sendInput = useCallback((data) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data }));
        }
    }, []);

    const killProcess = useCallback(() => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'kill' }));
        }
    }, []);

    const handleComposeSubmit = (e) => {
        e.preventDefault();
        if (!command.trim() || isRunning) return;
        sendCommand(command.trim());
        setCommand('');
    };

    const handleContainerKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendInput(e.target.value + '\n');
            e.target.value = '';
        }
    };

    const handleClear = () => {
        setOutput([]);
    };

    const handleReconnect = () => {
        addOutput({ type: 'system', data: 'Reconnecting...' });
        connect();
    };

    const switchMode = (newMode) => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setOutput([]);
        setConnected(false);
        setIsRunning(false);
        setMode(newMode);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => switchMode('container')}
                    className={`btn-sm ${mode === 'container' ? 'btn-primary' : 'btn-secondary'}`}
                >
                    <Monitor size={13} />
                    {t.terminal.containerMode}
                </button>
                <button
                    onClick={() => switchMode('compose')}
                    className={`btn-sm ${mode === 'compose' ? 'btn-primary' : 'btn-secondary'}`}
                >
                    <TerminalIcon size={13} />
                    {t.terminal.composeMode}
                </button>
            </div>

            <div className="card overflow-hidden">
                <div className="bg-surface-200 dark:bg-surface-800 px-4 py-2 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TerminalIcon size={14} className={connected ? (isRunning ? 'text-success animate-pulse' : 'text-success') : 'text-danger'} />
                        <span className="text-xs text-text-muted">
                            {mode === 'container'
                                ? `${container?.name || 'container'} / #`
                                : `docker compose [${stackName}]`
                            }
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        {(isRunning || (mode === 'container' && connected)) && (
                            <button onClick={killProcess} className="btn-ghost btn-sm text-danger hover:bg-danger-light" title={t.common.cancel}>
                                <XCircle size={12} />
                            </button>
                        )}
                        {!connected && (
                            <button onClick={handleReconnect} className="btn-ghost btn-sm text-warning">
                                ↻
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
                            {mode === 'container'
                                ? t.terminal.containerWaiting
                                : t.terminal.waiting
                            }
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

                {mode === 'compose' ? (
                    <form
                        onSubmit={handleComposeSubmit}
                        className="border-t border-border flex items-center"
                    >
                        <span className="text-primary-600 dark:text-primary-400 font-mono text-sm px-3">$</span>
                        <span className="text-text-muted font-mono text-xs">docker compose</span>
                        <input
                            type="text"
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            className="flex-1 bg-transparent text-text-primary font-mono text-sm px-2 py-2.5 focus:outline-none"
                            placeholder={isRunning ? '...' : t.terminal.placeholder}
                            disabled={!connected}
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={isRunning || !command.trim() || !connected}
                            className="px-3 py-2.5 text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                        >
                            <Send size={14} />
                        </button>
                    </form>
                ) : (
                    <div className="border-t border-border flex items-center">
                        <span className="text-success font-mono text-sm px-3">#</span>
                        <input
                            ref={inputRef}
                            type="text"
                            onKeyDown={handleContainerKeyDown}
                            className="flex-1 bg-transparent text-text-primary font-mono text-sm px-2 py-2.5 focus:outline-none"
                            placeholder={connected ? t.terminal.containerInput : '...'}
                            disabled={!connected}
                            autoFocus
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
