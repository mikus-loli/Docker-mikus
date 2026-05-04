import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useAuthStore } from '../store';
import { useI18n } from '../i18n';
import { Terminal as TerminalIcon, Monitor } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

const SHELLS = ['/bin/sh', '/bin/bash'];

function XtermTerminal({ container, shell, onDisconnect }) {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const wsRef = useRef(null);
    const fitAddonRef = useRef(null);
    const token = useAuthStore((s) => s.token);
    const { t } = useI18n();
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!terminalRef.current) return;

        const xterm = new XTerm({
            cursorBlink: true,
            cursorStyle: 'bar',
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, 'Courier New', monospace",
            theme: {
                background: '#1e1e2e',
                foreground: '#cdd6f4',
                cursor: '#f5e0dc',
                cursorAccent: '#1e1e2e',
                selectionBackground: '#585b7066',
                black: '#45475a',
                red: '#f38ba8',
                green: '#a6e3a1',
                yellow: '#f9e2af',
                blue: '#89b4fa',
                magenta: '#f5c2e7',
                cyan: '#94e2d5',
                white: '#bac2de',
                brightBlack: '#585b70',
                brightRed: '#f38ba8',
                brightGreen: '#a6e3a1',
                brightYellow: '#f9e2af',
                brightBlue: '#89b4fa',
                brightMagenta: '#f5c2e7',
                brightCyan: '#94e2d5',
                brightWhite: '#a6adc8',
            },
            allowProposedApi: true,
            scrollback: 10000,
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        xterm.loadAddon(fitAddon);
        xterm.loadAddon(webLinksAddon);

        xterm.open(terminalRef.current);

        setTimeout(() => {
            try { fitAddon.fit(); } catch {}
        }, 100);

        xtermRef.current = xterm;
        fitAddonRef.current = fitAddon;

        const resizeObserver = new ResizeObserver(() => {
            try { fitAddon.fit(); } catch {}
        });
        resizeObserver.observe(terminalRef.current);

        xterm.writeln('\x1b[1;33mConnecting...\x1b[0m');

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws?type=terminal&container=${container.containerId}&shell=${shell}&token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            const { cols, rows } = xterm;
            ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        };

        ws.onmessage = (event) => {
            if (typeof event.data === 'string') {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'ready') {
                        setConnected(true);
                    } else if (msg.type === 'error') {
                        xterm.writeln(`\r\n\x1b[31m${msg.data}\x1b[0m`);
                    } else if (msg.type === 'done') {
                        setConnected(false);
                        xterm.writeln(`\r\n\x1b[33m${t.terminal.sessionEnded || 'Session ended.'}\x1b[0m`);
                    }
                    return;
                } catch {}
            }
            if (ws.readyState === WebSocket.OPEN) {
                xterm.write(typeof event.data === 'string' ? event.data : new Uint8Array(event.data));
            }
        };

        ws.onerror = () => {
            setConnected(false);
            xterm.writeln(`\r\n\x1b[31m${t.terminal.connectionError}\x1b[0m`);
        };

        ws.onclose = () => {
            setConnected(false);
            wsRef.current = null;
        };

        const onResize = ({ cols, rows }) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'resize', cols, rows }));
            }
        };
        xterm.onResize(onResize);

        const onData = (data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        };
        xterm.onData(onData);

        return () => {
            resizeObserver.disconnect();
            ws.close();
            xterm.dispose();
            wsRef.current = null;
            xtermRef.current = null;
            fitAddonRef.current = null;
        };
    }, [container, shell, token]);

    return (
        <div className="card overflow-hidden">
            <div className="bg-surface-200 dark:bg-surface-800 px-4 py-2 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TerminalIcon size={14} className={connected ? 'text-success' : 'text-danger'} />
                    <span className="text-xs text-text-muted">
                        {container.name} • {shell.replace('/bin/', '')}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onDisconnect} className="btn-sm btn-secondary text-xs">
                        {t.terminal.disconnect || '断开'}
                    </button>
                </div>
            </div>
            <div ref={terminalRef} style={{ height: '500px', padding: '4px' }} />
        </div>
    );
}

export default function Terminal({ stackName, services }) {
    const [selectedContainer, setSelectedContainer] = useState(null);
    const [shell, setShell] = useState('/bin/sh');
    const { t } = useI18n();

    const runningServices = (services || []).filter(
        (svc) => svc.status === 'running' && svc.containerId
    );

    const handleSelectContainer = (svc) => {
        setSelectedContainer(svc);
    };

    const handleDisconnect = () => {
        setSelectedContainer(null);
    };

    if (!selectedContainer) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-text-primary">{t.terminal.title}</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted">{t.terminal.selectShell}</span>
                        {SHELLS.map((s) => (
                            <button
                                key={s}
                                onClick={() => setShell(s)}
                                className={`btn-sm ${shell === s ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                {s.replace('/bin/', '')}
                            </button>
                        ))}
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
                    <span className="text-text-muted text-sm">{selectedContainer.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">{t.terminal.selectShell}</span>
                    {SHELLS.map((s) => (
                        <button
                            key={s}
                            onClick={() => setShell(s)}
                            className={`btn-sm ${shell === s ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {s.replace('/bin/', '')}
                        </button>
                    ))}
                </div>
            </div>

            <XtermTerminal
                key={`${selectedContainer.containerId}-${shell}`}
                container={selectedContainer}
                shell={shell}
                onDisconnect={handleDisconnect}
            />
        </div>
    );
}
