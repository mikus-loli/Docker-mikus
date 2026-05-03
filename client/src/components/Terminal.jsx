import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store';
import { Terminal as TerminalIcon, Send, Trash2 } from 'lucide-react';

const PRESET_COMMANDS = [
    { label: 'up -d', command: 'up -d' },
    { label: 'down', command: 'down' },
    { label: 'ps', command: 'ps' },
    { label: 'config', command: 'config' },
    { label: 'pull', command: 'pull' },
    { label: 'logs', command: 'logs --tail=50' },
    { label: 'restart', command: 'restart' },
];

export default function Terminal({ stackName }) {
    const [output, setOutput] = useState([]);
    const [command, setCommand] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const wsRef = useRef(null);
    const terminalRef = useRef(null);
    const token = useAuthStore((s) => s.token);

    const connectAndRun = useCallback((cmd) => {
        if (wsRef.current) {
            wsRef.current.close();
        }

        setOutput((prev) => [...prev, { type: 'input', data: `$ docker compose ${cmd}` }]);
        setIsRunning(true);

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws?type=terminal&stack=${stackName}&token=${token}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'command', command: cmd }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'stdout' || msg.type === 'stderr') {
                    setOutput((prev) => [...prev, { type: msg.type, data: msg.data }]);
                } else if (msg.type === 'error') {
                    setOutput((prev) => [...prev, { type: 'error', data: msg.data }]);
                } else if (msg.type === 'exit') {
                    setOutput((prev) => [
                        ...prev,
                        { type: 'system', data: `Process exited with code ${msg.code}` },
                    ]);
                    setIsRunning(false);
                    ws.close();
                }
            } catch {}
        };

        ws.onerror = () => {
            setIsRunning(false);
            setOutput((prev) => [...prev, { type: 'error', data: 'Connection error' }]);
        };

        ws.onclose = () => {
            setIsRunning(false);
        };
    }, [stackName, token]);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [output]);

    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
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

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COMMANDS.map((preset) => (
                    <button
                        key={preset.command}
                        onClick={() => handlePreset(preset.command)}
                        disabled={isRunning}
                        className="btn-secondary btn-sm text-xs font-mono"
                    >
                        {preset.label}
                    </button>
                ))}
            </div>

            <div className="card overflow-hidden">
                <div className="bg-dark-800/50 px-4 py-2 border-b border-dark-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TerminalIcon size={14} className={isRunning ? 'text-emerald-400 animate-pulse' : 'text-dark-500'} />
                        <span className="text-xs text-dark-400">
                            docker compose [{stackName}]
                        </span>
                    </div>
                    <button onClick={handleClear} className="btn-ghost btn-sm text-dark-400">
                        <Trash2 size={12} />
                    </button>
                </div>
                <div
                    ref={terminalRef}
                    className="bg-dark-950 p-4 font-mono text-xs leading-relaxed overflow-auto"
                    style={{ height: '400px' }}
                >
                    {output.length === 0 ? (
                        <p className="text-dark-600">
                            Run a docker compose command or use the presets above.
                        </p>
                    ) : (
                        output.map((line, i) => (
                            <div
                                key={i}
                                className={`whitespace-pre-wrap break-all ${
                                    line.type === 'input'
                                        ? 'text-primary-400 font-bold'
                                        : line.type === 'stderr' || line.type === 'error'
                                        ? 'text-red-400'
                                        : line.type === 'system'
                                        ? 'text-dark-500 italic'
                                        : 'text-dark-200'
                                }`}
                            >
                                {line.data}
                            </div>
                        ))
                    )}
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="border-t border-dark-700/50 flex items-center"
                >
                    <span className="text-primary-400 font-mono text-sm px-3">$</span>
                    <span className="text-dark-400 font-mono text-xs">docker compose</span>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        className="flex-1 bg-transparent text-white font-mono text-sm px-2 py-2.5 focus:outline-none"
                        placeholder="up -d"
                        disabled={isRunning}
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={isRunning || !command.trim()}
                        className="px-3 py-2.5 text-dark-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <Send size={14} />
                    </button>
                </form>
            </div>
        </div>
    );
}
