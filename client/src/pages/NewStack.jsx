import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStackStore } from '../store';
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
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Stack name is required');
            return;
        }

        const stackName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        if (!/^[a-z0-9][a-z0-9_-]*$/.test(stackName)) {
            setError('Stack name must start with a letter or number and contain only lowercase letters, numbers, hyphens, and underscores');
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
                <button onClick={() => navigate('/')} className="btn-ghost text-dark-400">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">New Stack</h1>
                    <p className="text-dark-400 text-sm mt-0.5">Create a new Docker Compose stack</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1.5">
                        Stack Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input max-w-md"
                        placeholder="my-stack"
                        autoFocus
                        required
                    />
                    <p className="text-dark-500 text-xs mt-1">
                        Lowercase letters, numbers, hyphens, and underscores only
                    </p>
                </div>

                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <FileCode size={16} className="text-primary-400" />
                        <label className="text-sm font-medium text-dark-300">
                            docker-compose.yml
                        </label>
                    </div>
                    <div className="border border-dark-600 rounded-lg overflow-hidden">
                        <textarea
                            value={compose}
                            onChange={(e) => setCompose(e.target.value)}
                            className="w-full bg-dark-900 text-green-400 font-mono text-sm p-4 min-h-[300px] resize-y focus:outline-none"
                            spellCheck={false}
                        />
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <label className="text-sm font-medium text-dark-300">
                            .env (optional)
                        </label>
                    </div>
                    <div className="border border-dark-600 rounded-lg overflow-hidden">
                        <textarea
                            value={env}
                            onChange={(e) => setEnv(e.target.value)}
                            className="w-full bg-dark-900 text-amber-400 font-mono text-sm p-4 min-h-[120px] resize-y focus:outline-none"
                            placeholder="# Environment variables&#10;APP_ENV=production&#10;PORT=3000"
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
                        {saving ? 'Creating...' : 'Create Stack'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="btn-secondary"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
