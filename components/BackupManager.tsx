
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import * as backupService from '../services/backupService';
import { Save, Download, Trash2, Clock, FileJson, AlertCircle, Loader2, RotateCcw, ShieldAlert, Infinity as InfinityIcon, AlertTriangle, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface BackupManagerProps {
    backupEnabled?: boolean;
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// Modal de confirmação inline — substitui o confirm() nativo do browser
// (visual horrível, fora do design system). Estado mantido no BackupManager;
// onConfirm é o callback a executar quando o usuário confirma.
type ConfirmState = {
    title: string;
    description: React.ReactNode;
    confirmLabel: string;
    variant: 'danger' | 'warning';
    onConfirm: () => void;
} | null;

const ConfirmModal: React.FC<{ state: ConfirmState; onClose: () => void }> = ({ state, onClose }) => {
    if (!state) return null;
    const isDanger = state.variant === 'danger';
    return createPortal(
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-[#22262e] rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start gap-4 mb-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isDanger ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                    }`}>
                        <AlertTriangle className={`w-5 h-5 ${
                            isDanger ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                        }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{state.title}</h3>
                        <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">{state.description}</div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/40 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => { state.onConfirm(); onClose(); }}
                        className={`px-4 py-2 text-white rounded-lg font-bold text-sm transition-colors ${
                            isDanger
                                ? 'bg-rose-600 hover:bg-rose-700'
                                : 'bg-amber-600 hover:bg-amber-700'
                        }`}
                    >
                        {state.confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const BackupManager: React.FC<BackupManagerProps> = ({ backupEnabled = false, showToast }) => {
    const { t } = useLanguage();
    const [backups, setBackups] = useState<backupService.BackupFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [confirmState, setConfirmState] = useState<ConfirmState>(null);

    // Fallback pra showToast quando o componente é usado standalone (sem
    // o prop passado). Console-only — evita crash se quem usar esquecer.
    const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
        if (showToast) showToast(msg, type);
        else console.log(`[Backup ${type}] ${msg}`);
    };

    /** Extrai mensagem amigável do erro: prioriza `details` (mensagem real do
     *  Prisma/Node que o controller agora retorna), depois `error`, depois
     *  fallback genérico. Antes mostrava só "error_generic" e a info útil
     *  ficava perdida no console do server. */
    const errorMessage = (err: any, fallback: string): string => {
        return err?.response?.data?.details
            || err?.response?.data?.error
            || err?.message
            || fallback;
    };

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
            notify(t('backup_success') || 'Backup criado com sucesso', 'success');
        } catch (error: any) {
            console.error('Failed to create backup', error);
            notify(errorMessage(error, 'Erro ao criar backup'), 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteBackup = (filename: string) => {
        const isAuto = filename.includes('-auto-');
        setConfirmState({
            title: 'Excluir backup?',
            variant: 'danger',
            confirmLabel: 'Excluir',
            description: (
                <>
                    <p>Esse backup será apagado permanentemente.</p>
                    {!isAuto && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                            ⚠ Backup manual — só você criou e só você pode recriar. Tem certeza?
                        </p>
                    )}
                </>
            ),
            onConfirm: async () => {
                try {
                    await backupService.deleteBackup(filename);
                    setBackups(prev => prev.filter(b => b.filename !== filename));
                    notify('Backup excluído', 'success');
                } catch (error: any) {
                    console.error('Failed to delete backup', error);
                    notify(errorMessage(error, 'Erro ao excluir backup'), 'error');
                }
            }
        });
    };

    const handleRestore = (filename: string) => {
        setConfirmState({
            title: 'Restaurar este backup?',
            variant: 'danger',
            confirmLabel: 'Sim, restaurar',
            description: (
                <>
                    <p>
                        Esta ação <strong>apaga todos os dados atuais</strong> da empresa
                        (projetos, CTOs, clientes, integrações) e substitui pelo conteúdo do backup.
                    </p>
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                        Não pode ser desfeita. A página vai recarregar quando concluir.
                    </p>
                </>
            ),
            onConfirm: async () => {
                try {
                    setIsLoading(true);
                    await backupService.restoreBackup(filename);
                    notify(t('restore_success') || 'Restore concluído. Recarregando...', 'success');
                    setTimeout(() => window.location.reload(), 1200);
                } catch (error: any) {
                    console.error('Restore failed', error);
                    notify(errorMessage(error, 'Erro ao restaurar backup'), 'error');
                    setIsLoading(false);
                }
            }
        });
    };

    const handleUploadRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reset = () => { e.target.value = ''; };

        setConfirmState({
            title: 'Restaurar a partir desse arquivo?',
            variant: 'danger',
            confirmLabel: 'Sim, restaurar',
            description: (
                <>
                    <p>
                        Arquivo: <strong className="font-mono text-xs">{file.name}</strong>
                    </p>
                    <p>
                        Esta ação <strong>apaga todos os dados atuais</strong> da empresa
                        e substitui pelo conteúdo do arquivo. Não pode ser desfeita.
                    </p>
                </>
            ),
            onConfirm: async () => {
                try {
                    setIsLoading(true);
                    await backupService.uploadAndRestore(file);
                    notify(t('restore_success') || 'Restore concluído. Recarregando...', 'success');
                    setTimeout(() => window.location.reload(), 1200);
                } catch (error: any) {
                    console.error('Upload restore failed', error);
                    notify(errorMessage(error, 'Erro ao restaurar backup'), 'error');
                    setIsLoading(false);
                }
                reset();
            }
        });
        // Reset file input quando user cancela (handled no onClose do modal — vide useEffect abaixo)
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    /** Mostra data relativa quando recente, absoluta no resto. Mais escaneável
     *  que ISO crua (`2026-06-02T01:24:16`) na coluna principal. */
    const formatDate = (date: Date | string) => {
        const d = new Date(date);
        const diffMin = (Date.now() - d.getTime()) / 60000;
        if (diffMin < 1) return 'agora';
        if (diffMin < 60) return `há ${Math.floor(diffMin)} min`;
        if (diffMin < 60 * 24) return `há ${Math.floor(diffMin / 60)}h`;
        if (diffMin < 60 * 24 * 7) return `há ${Math.floor(diffMin / 60 / 24)} dias`;
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    /** Pra backups automáticos, calcula quantos dias faltam pra expiração
     *  (7 dias após createdAt). Manual retorna null (não expira). */
    const RETENTION_DAYS = 7;
    const getExpiration = (filename: string, createdAt: Date | string) => {
        if (!filename.includes('-auto-')) return null;
        const created = new Date(createdAt).getTime();
        const expires = created + RETENTION_DAYS * 24 * 60 * 60 * 1000;
        const daysLeft = Math.ceil((expires - Date.now()) / (24 * 60 * 60 * 1000));
        if (daysLeft <= 0) return { label: 'expira em breve', urgent: true };
        if (daysLeft === 1) return { label: 'expira amanhã', urgent: true };
        return { label: `expira em ${daysLeft} dias`, urgent: daysLeft <= 2 };
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Save className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
                        {t('backup_title')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('backup_desc')}
                    </p>
                </div>
                {backupEnabled && (
                    <div>
                        <input
                            type="file"
                            accept=".json,.gz,.enc,.json.gz,.json.gz.enc,application/json,application/gzip,application/octet-stream"
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
                )}
            </div>

            {/* Info banner — explica as regras do sistema upfront. Antes elas
                ficavam implícitas e o usuário só descobria quando perdia algo
                (auto-backup sumindo após 7d sem aviso). */}
            {backupEnabled && (
                <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 rounded-xl p-4 flex gap-3">
                    <ShieldAlert className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1 text-sm text-sky-900 dark:text-sky-100">
                        <p className="font-semibold">Como funciona o backup desta empresa</p>
                        <ul className="text-[13px] text-sky-800/90 dark:text-sky-200/90 space-y-0.5 list-disc list-inside marker:text-sky-400">
                            <li><strong>Automático</strong>: roda todo dia às 02:30, mantido por <strong>7 dias</strong> (depois é apagado).</li>
                            <li><strong>Manual</strong>: criado por você, fica <strong>permanente</strong> até você apagar.</li>
                            <li><strong>Restore é destrutivo</strong>: apaga tudo da empresa e substitui pelo conteúdo do backup. Não pode ser desfeito.</li>
                        </ul>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden shadow-sm animate-pulse">
                    <div className="bg-slate-50 dark:bg-[#22262e]/50 px-6 py-4 flex gap-16">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-3 w-20 bg-slate-200 dark:bg-slate-700/50 rounded" />)}
                    </div>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="px-6 py-4 flex items-center gap-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 shrink-0" />
                            <div className="h-4 w-48 bg-slate-100 dark:bg-slate-700/50 rounded" />
                            <div className="h-4 w-28 bg-slate-100 dark:bg-slate-700/50 rounded" />
                            <div className="h-4 w-16 bg-slate-100 dark:bg-slate-700/50 rounded" />
                            <div className="ml-auto h-8 w-20 bg-slate-100 dark:bg-slate-700/50 rounded-lg" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">{t('backup_filename')}</th>
                                <th className="px-6 py-4">{t('backup_date')}</th>
                                <th className="px-6 py-4">{t('backup_size')}</th>
                                <th className="px-6 py-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {backups.map(backup => {
                                const isAuto = backup.filename.includes('-auto-');
                                const expiration = getExpiration(backup.filename, backup.createdAt);
                                return (
                                    <tr key={backup.filename} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isAuto ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
                                                    <FileJson className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    {/* Título amigável — filename raw vai no title pra debug/hover */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span
                                                            className="font-semibold text-slate-900 dark:text-white text-sm"
                                                            title={backup.filename}
                                                        >
                                                            {isAuto ? 'Backup automático' : 'Backup manual'}
                                                        </span>
                                                        {/* Chip de retenção — comunica destino no contexto */}
                                                        {isAuto && expiration ? (
                                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                                expiration.urgent
                                                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                                            }`}>
                                                                <Clock className="w-2.5 h-2.5" />
                                                                {expiration.label}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                                                <InfinityIcon className="w-2.5 h-2.5" />
                                                                permanente
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className={`text-[10px] uppercase font-bold tracking-wide ${isAuto ? 'text-purple-500' : 'text-emerald-500'}`}>
                                                        {isAuto ? t('backup_auto') : t('backup_manual')}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            <div className="flex items-center gap-2" title={new Date(backup.createdAt).toLocaleString('pt-BR')}>
                                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                                {formatDate(backup.createdAt)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                                            {formatSize(backup.size)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-1">
                                                {/* Restore com label + ícone (RotateCcw, semântica universal de restore).
                                                    Atrito intencional: botão maior que os outros pra prevenir clique acidental
                                                    numa operação destrutiva. */}
                                                <button
                                                    onClick={() => handleRestore(backup.filename)}
                                                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors flex items-center gap-1.5"
                                                    title="Restore destrutivo — apaga dados atuais"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                    Restaurar
                                                </button>
                                                <button
                                                    onClick={() => backupService.downloadBackupFile(backup.filename)}
                                                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-lg transition-colors"
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
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-[#22262e] rounded-full flex items-center justify-center mx-auto mb-4">
                                            <FileJson className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nenhum backup ainda</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                                            {backupEnabled
                                                ? 'O primeiro backup automático sai às 02:30. Quer um snapshot agora? Use "Criar backup" no topo.'
                                                : 'Seu plano atual não inclui backup. Faça upgrade pra ter snapshots automáticos diários.'}
                                        </p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
        </div>
    );
};
