import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStackStore } from '../store';
import { useI18n } from '../i18n';
import { ArrowLeft, Save, FileCode } from 'lucide-react';

const defaultCompose = `services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    restart: unless-stopped
`;

export default function NewStack() {
    const [name, setName] = useState('');
    const [compose, setCompose] = useState(defaultCompose);
    const [env, setEnv] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const { createStack } = useStackStore();
    const { t } = useI18n();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError(t.stack.nameRequired);
            return;
        }

        const stackName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        if (!/^[a-z0-9][a-z0-9_-]*$/.test(stackName)) {
            setError(t.stack.stackNameHint);
            return;
        }

        setSaving(true);
        setError(null);
        try {
            await createStack(stackName, compose, env);
            navigate(`/stack/${stackName}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/')} className="btn-ghost text-text-muted">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">{t.stack.newStack}</h1>
                    <p className="text-text-muted text-sm mt-0.5">{t.stack.createStack}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="bg-danger-light border border-danger/30 rounded-lg p-3 text-danger-dark dark:text-danger text-sm">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                        {t.stack.stackName}
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input max-w-md"
                        placeholder={t.stack.stackNamePlaceholder}
                        autoFocus
                        required
                    />
                    <p className="text-text-muted text-xs mt-1">
                        {t.stack.stackNameHint}
                    </p>
                </div>

                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <FileCode size={16} className="text-primary-600 dark:text-primary-400" />
                        <label className="text-sm font-medium text-text-secondary">
                            {t.stack.composeFile}
                        </label>
                    </div>
                    <div className="border border-border rounded-lg overflow-hidden">
                        <textarea
                            value={compose}
                            onChange={(e) => setCompose(e.target.value)}
                            className="w-full bg-surface-50 dark:bg-surface-950 text-success-dark dark:text-success font-mono text-sm p-4 min-h-[300px] resize-y focus:outline-none"
                            spellCheck={false}
                        />
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <label className="text-sm font-medium text-text-secondary">
                            {t.stack.envFile}
                        </label>
                    </div>
                    <div className="border border-border rounded-lg overflow-hidden">
                        <textarea
                            value={env}
                            onChange={(e) => setEnv(e.target.value)}
                            className="w-full bg-surface-50 dark:bg-surface-950 text-warning-dark dark:text-warning font-mono text-sm p-4 min-h-[120px] resize-y focus:outline-none"
                            placeholder={t.stack.envFilePlaceholder}
                            spellCheck={false}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary"
                    >
                        <Save size={16} />
                        {saving ? t.stack.creating : t.stack.createStack}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="btn-secondary"
                    >
                        {t.common.cancel}
                    </button>
                </div>
            </form>
        </div>
    );
}
