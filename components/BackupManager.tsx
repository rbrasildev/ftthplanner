
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import * as backupService from '../services/backupService';
import { Save, Download, Trash2, Clock, FileJson, AlertCircle, Loader2 } from 'lucide-react';

export const BackupManager: React.FC = () => {
    const { t } = useLanguage();
    const [backups, setBackups] = useState<backupService.BackupFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    const fetchBackups = async () => {
        setIsLoading(true);
        try {
            const data = await backupService.listBackups();
            setBackups(data);
        } catch (error) {
            console.error('Failed to load backups', error);
            // alert(t('error_generic')); // Don't annoy user on load fail
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBackups();
    }, []);

    const handleCreateBackup = async () => {
        setIsCreating(true);
        try {
            const newBackup = await backupService.createBackup();
            setBackups(prev => [newBackup, ...prev]);
            alert(t('backup_success'));
        } catch (error) {
            console.error('Failed to create backup', error);
            alert(t('error_generic'));
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteBackup = async (filename: string) => {
        if (!confirm(t('confirm_delete_backup'))) return;

        try {
            await backupService.deleteBackup(filename);
            setBackups(prev => prev.filter(b => b.filename !== filename));
            alert(t('changes_saved'));
        } catch (error) {
            console.error('Failed to delete backup', error);
            alert(t('error_generic'));
        }
    };

    const handleRestore = async (filename: string) => {
        if (!confirm(t('restore_confirm') || 'Warning: This will overwrite your current data. Continue?')) return;

        try {
            setIsLoading(true);
            await backupService.restoreBackup(filename);
            alert(t('restore_success') || 'Restore successful! The page will reload.');
            window.location.reload();
        } catch (error) {
            console.error('Restore failed', error);
            alert(t('error_generic'));
            setIsLoading(false);
        }
    };

    const handleUploadRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm(t('restore_confirm') || 'Warning: This will overwrite your current data. Continue?')) {
            e.target.value = ''; // reset
            return;
        }

        try {
            setIsLoading(true);
            await backupService.uploadAndRestore(file);
            alert(t('restore_success') || 'Restore successful! The page will reload.');
            window.location.reload();
        } catch (error) {
            console.error('Upload restore failed', error);
            alert(t('error_generic'));
            setIsLoading(false);
        }
        e.target.value = '';
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Save className="w-7 h-7 text-sky-500 dark:text-sky-400" />
                        {t('backup_title')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('backup_desc')}
                    </p>
                </div>
                <div>
                    <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        id="backup-upload"
                        onChange={handleUploadRestore}
                    />
                    <label
                        htmlFor="backup-upload"
                        className={`px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-2 font-bold text-sm transition cursor-pointer shadow-sm mr-2 inline-flex ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <FileJson className="w-4 h-4" />
                        {t('upload_restore') || 'Upload & Restore'}
                    </label>
                    <button
                        onClick={handleCreateBackup}
                        disabled={isCreating || isLoading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg inline-flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-emerald-900/20 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {t('create_backup')}
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">{t('backup_filename')}</th>
                                <th className="px-6 py-4">{t('backup_date')}</th>
                                <th className="px-6 py-4">{t('backup_size')}</th>
                                <th className="px-6 py-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {backups.map(backup => {
                                const isAuto = backup.filename.includes('auto');
                                return (
                                    <tr key={backup.filename} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAuto ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
                                                <FileJson className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="block">{backup.filename}</span>
                                                <span className={`text-[10px] uppercase font-bold tracking-wide ${isAuto ? 'text-purple-500' : 'text-emerald-500'}`}>
                                                    {isAuto ? t('backup_auto') : t('backup_manual')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5" />
                                                {new Date(backup.createdAt).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono">
                                            {formatSize(backup.size)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleRestore(backup.filename)}
                                                    className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 rounded-lg transition-colors"
                                                    title={t('restore') || 'Restore'}
                                                >
                                                    <Clock className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => backupService.downloadBackupFile(backup.filename)}
                                                    className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/10 rounded-lg transition-colors"
                                                    title={t('download')}
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteBackup(backup.filename)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                                                    title={t('delete')}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {backups.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                        </div>
                                        <p>{t('no_backups')}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
