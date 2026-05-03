import { useState } from 'react';
import { useAuthStore, useSystemStore } from '../store';
import { useI18n } from '../i18n';
import { Shield, Key, Server, RefreshCw } from 'lucide-react';

export default function Settings() {
    const { user, changePassword } = useAuthStore();
    const { info, fetchSystemInfo } = useSystemStore();
    const { t } = useI18n();
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
            setError(t.auth.passwordMismatch);
            return;
        }

        if (newPassword.length < 4) {
            setError(t.auth.passwordTooShort);
            return;
        }

        setSaving(true);
        try {
            await changePassword(currentPassword, newPassword);
            setMessage(t.auth.passwordChanged);
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
                <h1 className="text-2xl font-bold text-text-primary">{t.common.settings}</h1>
                <p className="text-text-muted text-sm mt-1">{t.settings.subtitle}</p>
            </div>

            <div className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary-100 dark:bg-primary-500/15 rounded-lg flex items-center justify-center">
                        <Shield size={20} className="text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                        <h2 className="text-text-primary font-semibold">{t.settings.account}</h2>
                        <p className="text-text-muted text-sm">{t.settings.loggedInAs.replace('{username}', user?.username || 'admin')}</p>
                    </div>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                    {error && (
                        <div className="bg-danger-light border border-danger/30 rounded-lg p-3 text-danger-dark dark:text-danger text-sm">
                            {error}
                        </div>
                    )}
                    {message && (
                        <div className="bg-success-light border border-success/30 rounded-lg p-3 text-success-dark dark:text-success text-sm">
                            {message}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">
                            {t.auth.currentPassword}
                        </label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="input"
                            placeholder={t.auth.currentPasswordPlaceholder}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">
                            {t.auth.newPassword}
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="input"
                            placeholder={t.auth.newPasswordPlaceholder}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">
                            {t.auth.confirmNewPassword}
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="input"
                            placeholder={t.auth.confirmPasswordPlaceholder}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary"
                    >
                        <Key size={16} />
                        {saving ? t.common.loading : t.auth.changePassword}
                    </button>
                </form>
            </div>

            <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-success-light rounded-lg flex items-center justify-center">
                            <Server size={20} className="text-success-dark dark:text-success" />
                        </div>
                        <div>
                            <h2 className="text-text-primary font-semibold">{t.settings.dockerSystem}</h2>
                            <p className="text-text-muted text-sm">{t.settings.dockerInfo}</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchSystemInfo}
                        className="btn-secondary btn-sm"
                    >
                        <RefreshCw size={14} />
                        {t.common.refresh}
                    </button>
                </div>

                {info ? (
                    <div className="grid grid-cols-2 gap-3">
                        <InfoItem label={t.settings.serverVersion} value={info.serverVersion} />
                        <InfoItem label={t.settings.apiVersion} value={info.apiVersion} />
                        <InfoItem label={t.settings.operatingSystem} value={info.operatingSystem} />
                        <InfoItem label={t.dashboard.cpuCores} value={info.cpuCores} />
                        <InfoItem label={t.settings.totalMemory} value={formatBytes(info.totalMemory)} />
                        <InfoItem label={t.settings.containers} value={t.settings.containersRunning.replace('{running}', info.containersRunning || 0).replace('{total}', info.containers || 0)} />
                        <InfoItem label={t.settings.images} value={info.images} />
                    </div>
                ) : (
                    <p className="text-text-muted text-sm">{t.common.loading}</p>
                )}
            </div>
        </div>
    );
}

function InfoItem({ label, value }) {
    return (
        <div className="bg-surface-100 dark:bg-surface-800 rounded-lg p-3">
            <p className="text-text-muted text-xs mb-0.5">{label}</p>
            <p className="text-text-primary text-sm font-medium truncate">{value || '-'}</p>
        </div>
    );
}

function formatBytes(bytes) {
    if (!bytes) return '-';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
}
