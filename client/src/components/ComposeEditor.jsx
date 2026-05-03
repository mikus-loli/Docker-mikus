import { useState, useEffect, useCallback } from 'react';
import { useStackStore } from '../store';
import { useI18n } from '../i18n';
import { Save, FileCode, FileText } from 'lucide-react';

export default function ComposeEditor({ stackName, composeData, onLoad }) {
    const { updateStack } = useStackStore();
    const { t } = useI18n();
    const [compose, setCompose] = useState('');
    const [env, setEnv] = useState('');
    const [saving, setSaving] = useState(false);
    const [activeFile, setActiveFile] = useState('compose');
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (composeData) {
            setCompose(composeData.compose || '');
            setEnv(composeData.env || '');
        }
    }, [composeData]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        setError(null);
        try {
            await updateStack(stackName, compose, env);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }, [stackName, compose, env, updateStack]);

    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleSave]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 bg-surface-200 dark:bg-surface-800 rounded-lg border border-border p-0.5">
                    <button
                        onClick={() => setActiveFile('compose')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            activeFile === 'compose'
                                ? 'bg-surface-400 dark:bg-surface-600 text-text-primary'
                                : 'text-text-muted hover:text-text-primary'
                        }`}
                    >
                        <FileCode size={12} />
                        docker-compose.yml
                    </button>
                    <button
                        onClick={() => setActiveFile('env')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            activeFile === 'env'
                                ? 'bg-surface-400 dark:bg-surface-600 text-text-primary'
                                : 'text-text-muted hover:text-text-primary'
                        }`}
                    >
                        <FileText size={12} />
                        .env
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {error && (
                        <span className="text-danger text-xs">{error}</span>
                    )}
                    {saved && (
                        <span className="text-success-dark dark:text-success text-xs">{t.stack.saved}</span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary btn-sm"
                    >
                        <Save size={13} />
                        {saving ? t.stack.saving : t.common.save}
                    </button>
                </div>
            </div>

            <div className="card overflow-hidden">
                {activeFile === 'compose' ? (
                    <div className="relative">
                        <div className="absolute top-0 right-0 p-2 z-10">
                            <span className="text-[10px] text-text-muted bg-surface-200 dark:bg-surface-700 px-2 py-1 rounded">
                                {t.stack.ctrlSToSave}
                            </span>
                        </div>
                        <textarea
                            value={compose}
                            onChange={(e) => setCompose(e.target.value)}
                            className="w-full bg-surface-50 dark:bg-surface-950 text-success-dark dark:text-success font-mono text-sm p-4 min-h-[500px] resize-y focus:outline-none leading-relaxed"
                            spellCheck={false}
                        />
                    </div>
                ) : (
                    <textarea
                        value={env}
                        onChange={(e) => setEnv(e.target.value)}
                        className="w-full bg-surface-50 dark:bg-surface-950 text-warning-dark dark:text-warning font-mono text-sm p-4 min-h-[500px] resize-y focus:outline-none leading-relaxed"
                        placeholder={t.stack.envFilePlaceholder}
                        spellCheck={false}
                    />
                )}
            </div>
        </div>
    );
}
