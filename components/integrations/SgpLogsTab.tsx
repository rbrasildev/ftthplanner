import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { Loader2, AlertCircle, CheckCircle2, Clock, Search, RefreshCw } from 'lucide-react';
import api from '../../services/api';

interface SgpLogsTabProps {
    providerType: 'IXC' | 'GENERIC';
}

interface IntegrationLog {
    id: string;
    level: 'INFO' | 'WARNING' | 'ERROR';
    message: string;
    details?: string;
    createdAt: string;
}

export const SgpLogsTab: React.FC<SgpLogsTabProps> = ({ providerType }) => {
    const { t } = useLanguage();
    const [logs, setLogs] = useState<IntegrationLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const res = await api.get(`/integrations/sgp/logs/${providerType}`);
            setLogs(res.data || []);
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [providerType]);

    const filteredLogs = logs.filter(log =>
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4">
                <div className="relative w-full sm:w-72 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500" />
                    <input
                        type="text"
                        placeholder="Buscar log..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={isLoading}
                    className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50"
                    title="Atualizar Logs"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
            ) : filteredLogs.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center">
                    <CheckCircle2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-slate-500 font-medium">Nenhum log recente.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredLogs.map(log => (
                        <div key={log.id} className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex gap-4">
                            <div className="mt-0.5">
                                {log.level === 'INFO' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                                {log.level === 'WARNING' && <AlertCircle className="w-5 h-5 text-amber-500" />}
                                {log.level === 'ERROR' && <AlertCircle className="w-5 h-5 text-red-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-4 mb-1">
                                    <p className={`font-semibold text-sm truncate ${log.level === 'ERROR' ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-200'}`}>
                                        {log.message}
                                    </p>
                                    <span className="text-xs text-slate-500 whitespace-nowrap flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(log.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                {log.details && (
                                    <pre className="text-xs font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 overflow-x-auto">
                                        {log.details}
                                    </pre>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
