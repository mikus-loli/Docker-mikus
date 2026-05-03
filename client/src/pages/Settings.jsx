import { useState } from 'react';
import { useAuthStore, useSystemStore } from '../store';
import { Shield, Key, Server, RefreshCw, Save } from 'lucide-react';

export default function Settings() {
    const { user, changePassword } = useAuthStore();
    const { info, fetchSystemInfo } = useSystemStore();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (newPassword.length < 4) {
            setError('Password must be at least 4 characters');
            return;
        }

        setSaving(true);
        try {
            await changePassword(currentPassword, newPassword);
            setMessage('Password changed successfully');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="text-dark-400 text-sm mt-1">Manage your Mikus instance</p>
            </div>

            <div className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary-500/15 rounded-lg flex items-center justify-center">
                        <Shield size={20} className="text-primary-400" />
                    </div>
                    <div>
                        <h2 className="text-white font-semibold">Account</h2>
                        <p className="text-dark-400 text-sm">Logged in as {user?.username || 'admin'}</p>
                    </div>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                    {message && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-emerald-400 text-sm">
                            {message}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-1.5">
                            Current Password
                        </label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="input"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-1.5">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="input"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-1.5">
                            Confirm New Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="input"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary"
                    >
                        <Key size={16} />
                        {saving ? 'Changing...' : 'Change Password'}
                    </button>
                </form>
            </div>

            <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/15 rounded-lg flex items-center justify-center">
                            <Server size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-semibold">Docker System</h2>
                            <p className="text-dark-400 text-sm">Docker engine information</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchSystemInfo}
                        className="btn-secondary btn-sm"
                    >
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                </div>

                {info ? (
                    <div className="grid grid-cols-2 gap-3">
                        <InfoItem label="Server Version" value={info.serverVersion} />
                        <InfoItem label="API Version" value={info.apiVersion} />
                        <InfoItem label="OS" value={info.operatingSystem} />
                        <InfoItem label="CPU Cores" value={info.cpuCores} />
                        <InfoItem label="Total Memory" value={formatBytes(info.totalMemory)} />
                        <InfoItem label="Containers" value={`${info.containersRunning || 0} running / ${info.containers || 0} total`} />
                        <InfoItem label="Images" value={info.images} />
                    </div>
                ) : (
                    <p className="text-dark-500 text-sm">Loading system info...</p>
                )}
            </div>
        </div>
    );
}

function InfoItem({ label, value }) {
    return (
        <div className="bg-dark-800/50 rounded-lg p-3">
            <p className="text-dark-500 text-xs mb-0.5">{label}</p>
            <p className="text-white text-sm font-medium truncate">{value || '-'}</p>
        </div>
    );
}

function formatBytes(bytes) {
    if (!bytes) return '-';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
}
