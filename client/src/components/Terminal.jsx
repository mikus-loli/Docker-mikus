import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store';
import { useI18n } from '../i18n';
import { Terminal as TerminalIcon, Trash2, XCircle, Monitor } from 'lucide-react';

const MAX_OUTPUT_LENGTH = 100000;

export default function Terminal({ stackName, services, initialContainer }) {
    const [output, setOutput] = useState('');
    const [connected, setConnected] = useState(false);
    const [selectedContainer, setSelectedContainer] = useState(initialContainer || null);
    const [shell, setShell] = useState('/bin/sh');
    const wsRef = useRef(null);
    const terminalRef = useRef(null);
    const token = useAuthStore((s) => s.token);
    const { t } = useI18n();
    const pingRef = useRef(null);

    const runningServices = (services || []).filter(
        (svc) => svc.status === 'running' && svc.containerId
    );

    const appendOutput = useCallback((data) => {
        setOutput((prev) => {
            const next = prev + data;
            if (next.length > MAX_OUTPUT_LENGTH) {
                return next.slice(-60000);
            }
            return next;
        });
    }, []);

    const connect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        if (!selectedContainer?.containerId) return;

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws?type=terminal&container=${selectedContainer.containerId}&shell=${shell}&token=${token}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'ready') {
                    setConnected(true);
                    appendOutput(`\r\n\x1b[1;32mConnected to ${selectedContainer.name || msg.containerId} (${msg.shell})\x1b[0m\r\n`);
                } else if (msg.type === 'stdout' || msg.type === 'stderr') {
                    appendOutput(msg.data);
                } else if (msg.type === 'error') {
                    appendOutput(`\r\n\x1b[31m${msg.data}\x1b[0m\r\n`);
                } else if (msg.type === 'done') {
                    appendOutput(`\r\n\x1b[33m${t.terminal.sessionEnded || 'Session ended.'}\x1b[0m\r\n`);
                    setConnected(false);
                }
            } catch {}
        };

        ws.onerror = () => {
            setConnected(false);
            appendOutput(`\r\n\x1b[31m${t.terminal.connectionError}\x1b[0m\r\n`);
        };

        ws.onclose = () => {
            setConnected(false);
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
    }, [selectedContainer, shell, token, appendOutput, t]);

    useEffect(() => {
        if (selectedContainer?.containerId) {
            connect();
        }
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
    }, [selectedContainer, shell]);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [output]);

    useEffect(() => {
        if (connected && terminalRef.current) {
            terminalRef.current.focus();
        }
    }, [connected]);

    const sendInput = useCallback((data) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data }));
        }
    }, []);

    const handleTerminalKeyDown = useCallback((e) => {
        if (!connected) return;

        if (e.key === 'Backspace') {
            e.preventDefault();
            sendInput('\x7f');
            return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            sendInput('\t');
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            sendInput('\r');
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            sendInput('\x1b');
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            sendInput('\x1b[A');
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            sendInput('\x1b[B');
            return;
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            sendInput('\x1b[C');
            return;
        }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            sendInput('\x1b[D');
            return;
        }

        if (e.key === 'Home') {
            e.preventDefault();
            sendInput('\x1b[H');
            return;
        }
        if (e.key === 'End') {
            e.preventDefault();
            sendInput('\x1b[F');
            return;
        }

        if (e.key === 'Delete') {
            e.preventDefault();
            sendInput('\x1b[3~');
            return;
        }

        if (e.key === 'PageUp') {
            e.preventDefault();
            sendInput('\x1b[5~');
            return;
        }
        if (e.key === 'PageDown') {
            e.preventDefault();
            sendInput('\x1b[6~');
            return;
        }

        if (e.ctrlKey) {
            const ctrlMap = {
                'a': '\x01', 'b': '\x02', 'c': '\x03', 'd': '\x04',
                'e': '\x05', 'f': '\x06', 'g': '\x07', 'h': '\x08',
                'i': '\x09', 'j': '\x0a', 'k': '\x0b', 'l': '\x0c',
                'm': '\x0d', 'n': '\x0e', 'o': '\x0f', 'p': '\x10',
                'q': '\x11', 'r': '\x12', 's': '\x13', 't': '\x14',
                'u': '\x15', 'v': '\x16', 'w': '\x17', 'x': '\x18',
                'y': '\x19', 'z': '\x1a',
            };
            const ch = ctrlMap[e.key.toLowerCase()];
            if (ch) {
                e.preventDefault();
                sendInput(ch);
                return;
            }
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            sendInput(e.key);
        }
    }, [connected, sendInput]);

    const handleClear = () => {
        setOutput('');
    };

    const handleReconnect = () => {
        setOutput('');
        setConnected(false);
        connect();
    };

    const handleSelectContainer = (svc) => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setOutput('');
        setConnected(false);
        setSelectedContainer(svc);
    };

    const handleShellChange = (newShell) => {
        if (connected) {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            setOutput('');
            setConnected(false);
        }
        setShell(newShell);
    };

    const handleDisconnect = () => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setOutput('');
        setConnected(false);
        setSelectedContainer(null);
    };

    if (!selectedContainer) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-text-primary">{t.terminal.title}</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted">{t.terminal.selectShell}</span>
                        <button
                            onClick={() => handleShellChange('/bin/sh')}
                            className={`btn-sm ${shell === '/bin/sh' ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            sh
                        </button>
                        <button
                            onClick={() => handleShellChange('/bin/bash')}
                            className={`btn-sm ${shell === '/bin/bash' ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            bash
                        </button>
                    </div>
                </div>

                {runningServices.length === 0 ? (
                    <div className="card p-8 text-center">
                        <Monitor size={32} className="text-text-muted mx-auto mb-3" />
                        <p className="text-text-secondary">{t.terminal.noRunningServices || '没有运行中的服务'}</p>
                        <p className="text-text-muted text-sm mt-1">{t.terminal.startServiceFirst || '请先启动服务后再进入容器终端'}</p>
                    </div>
                ) : (
                    <div className="card overflow-hidden">
                        <div className="px-5 py-3 bg-surface-200 dark:bg-surface-800 text-xs font-medium text-text-muted uppercase tracking-wider border-b border-border">
                            {t.terminal.selectContainer || '选择一个运行中的服务进入容器终端'}
                        </div>
                        <div className="divide-y divide-border">
                            {runningServices.map((svc) => (
                                <button
                                    key={svc.containerId}
                                    onClick={() => handleSelectContainer(svc)}
                                    className="w-full grid grid-cols-12 gap-4 px-5 py-3 items-center hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors text-left"
                                >
                                    <div className="col-span-4 flex items-center gap-2.5">
                                        <span className="w-2 h-2 rounded-full bg-success" />
                                        <span className="text-text-primary font-medium text-sm">{svc.name}</span>
                                    </div>
                                    <div className="col-span-5 text-text-muted text-sm font-mono truncate">
                                        {svc.image}
                                    </div>
                                    <div className="col-span-3 text-right">
                                        <span className="btn-sm btn-primary">
                                            <TerminalIcon size={13} />
                                            {t.terminal.connect || '连接'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-text-primary">{t.terminal.title}</h2>
                    <span className="text-text-muted text-sm">
                        {selectedContainer.name}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">{t.terminal.selectShell}</span>
                    <button
                        onClick={() => handleShellChange('/bin/sh')}
                        className={`btn-sm ${shell === '/bin/sh' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        sh
                    </button>
                    <button
                        onClick={() => handleShellChange('/bin/bash')}
                        className={`btn-sm ${shell === '/bin/bash' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        bash
                    </button>
                    <button
                        onClick={handleDisconnect}
                        className="btn-sm btn-secondary"
                    >
                        {t.terminal.disconnect || '断开'}
                    </button>
                </div>
            </div>

            <div className="card overflow-hidden">
                <div className="bg-surface-200 dark:bg-surface-800 px-4 py-2 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TerminalIcon size={14} className={connected ? 'text-success' : 'text-danger'} />
                        <span className="text-xs text-text-muted">
                            {selectedContainer.name} • {shell.replace('/bin/', '')}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
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
                    tabIndex={0}
                    onKeyDown={handleTerminalKeyDown}
                    className="bg-surface-50 dark:bg-surface-950 p-4 font-mono text-xs leading-relaxed overflow-auto cursor-text focus:outline-none focus:ring-1 focus:ring-primary-500"
                    style={{ height: '400px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                >
                    {output || (connected ? '' : t.terminal.containerInput)}
                </div>
            </div>
        </div>
    );
}
