import React, { useEffect, useMemo, useState } from 'react';
import { Search, FileDown, RefreshCw, Plus, Pencil, Trash2, LogIn, LogOut, Lock, Activity, ChevronDown, X, Loader2 } from 'lucide-react';
import * as saasService from '../../services/saasService';

interface AuditLog {
    id: string;
    userId: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    details: any;
    ipAddress?: string | null;
    createdAt: string;
    user?: { username: string; role: string } | null;
}

const PAGE_SIZE = 50;

// Mapeia o verbo da ação pra estilo visual + ícone + cor.
const ACTION_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    CREATE: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: <Plus className="w-3 h-3" />, label: 'Criou' },
    UPDATE: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: <Pencil className="w-3 h-3" />, label: 'Atualizou' },
    DELETE: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400', icon: <Trash2 className="w-3 h-3" />, label: 'Excluiu' },
    LOGIN: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', icon: <LogIn className="w-3 h-3" />, label: 'Entrou' },
    LOGOUT: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', icon: <LogOut className="w-3 h-3" />, label: 'Saiu' },
    PASSWORD_CHANGE: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: <Lock className="w-3 h-3" />, label: 'Mudou senha' },
};
const verbOf = (action: string): keyof typeof ACTION_STYLE | null => {
    const u = action.toUpperCase();
    if (u.includes('CREATE')) return 'CREATE';
    if (u.includes('UPDATE')) return 'UPDATE';
    if (u.includes('DELETE')) return 'DELETE';
    if (u.includes('LOGIN')) return 'LOGIN';
    if (u.includes('LOGOUT')) return 'LOGOUT';
    if (u.includes('PASSWORD')) return 'PASSWORD_CHANGE';
    return null;
};

const ENTITY_LABEL: Record<string, string> = {
    Company: 'Empresa', User: 'Usuário', Project: 'Projeto', Plan: 'Plano',
    CTO: 'CTO', POP: 'POP', Cable: 'Cabo', Splitter: 'Splitter', OLT: 'OLT', DIO: 'DIO',
    Catalog: 'Catálogo', Setting: 'Configuração', SYSTEM: 'Sistema',
};
const entityLabel = (e: string) => ENTITY_LABEL[e] || e;

const formatDetails = (details: any): string => {
    if (!details) return '—';
    if (typeof details === 'string') return details;
    if (typeof details !== 'object') return String(details);
    const d = details as any;
    if (d.targetName) return d.targetName + (d.field ? ` · ${d.field}` : '');
    if (d.name) return d.name;
    if (d.title) return d.title;
    if (d.message) return d.message;
    // Resumo de campos atualizados
    const updated = d.updated || d.changes;
    if (updated && typeof updated === 'object') {
        const keys = Object.keys(updated).slice(0, 3);
        if (keys.length > 0) return keys.join(', ');
    }
    return Object.keys(d).slice(0, 4).join(', ') || '—';
};

interface Props {
    refreshSignal?: number; // bump pra forçar reload externo
}

export const SaasAuditLogs: React.FC<Props> = ({ refreshSignal }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState<string>('ALL');
    const [entityFilter, setEntityFilter] = useState<string>('ALL');
    const [from, setFrom] = useState<string>('');
    const [to, setTo] = useState<string>('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [skip, setSkip] = useState(0);

    const queryParams = useMemo(() => {
        const p: any = { limit: PAGE_SIZE, skip };
        if (actionFilter !== 'ALL') p.action = actionFilter;
        if (entityFilter !== 'ALL') p.entity = entityFilter;
        if (from) p.from = new Date(from).toISOString();
        if (to) p.to = new Date(`${to}T23:59:59`).toISOString();
        return p;
    }, [actionFilter, entityFilter, from, to, skip]);

    // Quando filtros mudam (não skip), reseta paginação e recarrega do zero.
    useEffect(() => {
        setSkip(0);
        const load = async () => {
            try {
                setLoading(true);
                const res = await saasService.getAuditLogsPaged({ ...queryParams, skip: 0 });
                setLogs(res.items);
                setTotal(res.total);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actionFilter, entityFilter, from, to, refreshSignal]);

    const loadMore = async () => {
        const nextSkip = logs.length;
        try {
            setLoadingMore(true);
            const res = await saasService.getAuditLogsPaged({ ...queryParams, skip: nextSkip });
            setLogs(prev => [...prev, ...res.items]);
            setSkip(nextSkip);
            setTotal(res.total);
        } catch (e) { console.error(e); }
        finally { setLoadingMore(false); }
    };

    // Busca textual: client-side, em cima do que está carregado.
    const visibleLogs = useMemo(() => {
        if (!search) return logs;
        const term = search.toLowerCase();
        return logs.filter(l =>
            (l.user?.username || '').toLowerCase().includes(term)
            || (l.action || '').toLowerCase().includes(term)
            || (l.entity || '').toLowerCase().includes(term)
            || (l.ipAddress || '').toLowerCase().includes(term)
            || JSON.stringify(l.details || {}).toLowerCase().includes(term)
        );
    }, [logs, search]);

    const exportCsv = () => {
        const headers = ['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'ID', 'IP', 'Detalhes'];
        const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = visibleLogs.map(l => [
            new Date(l.createdAt).toLocaleString('pt-BR'),
            l.user?.username || 'Sistema',
            l.action,
            l.entity,
            l.entityId || '',
            l.ipAddress || '',
            JSON.stringify(l.details || {}),
        ].map(esc).join(','));
        const csv = '﻿' + [headers.map(esc).join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const hasFilters = actionFilter !== 'ALL' || entityFilter !== 'ALL' || from || to || search;
    const clearFilters = () => {
        setSearch(''); setActionFilter('ALL'); setEntityFilter('ALL'); setFrom(''); setTo('');
    };

    return (
        <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700/30 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 className="font-bold text-lg">Logs de auditoria</h3>
                        <p className="text-sm text-slate-500">Toda ação relevante feita no SaaS é registrada aqui.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setSkip(0); /* trigger via dummy state */ setActionFilter(a => a); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 hover:border-emerald-400 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
                            title="Recarregar"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={exportCsv}
                            disabled={visibleLogs.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 hover:border-emerald-400 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
                            title="Exportar CSV"
                        >
                            <FileDown className="w-3.5 h-3.5" />
                            CSV
                        </button>
                    </div>
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por usuário, ação, entidade, IP ou conteúdo..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-[#f9fafb] dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <select
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl text-xs font-bold py-2 pl-3 pr-8 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                        <option value="ALL">Todas as ações</option>
                        <option value="CREATE">Criar</option>
                        <option value="UPDATE">Atualizar</option>
                        <option value="DELETE">Excluir</option>
                        <option value="LOGIN">Login</option>
                        <option value="LOGOUT">Logout</option>
                        <option value="PASSWORD_CHANGE">Mudança de senha</option>
                    </select>
                    <select
                        value={entityFilter}
                        onChange={(e) => setEntityFilter(e.target.value)}
                        className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl text-xs font-bold py-2 pl-3 pr-8 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                        <option value="ALL">Todas as entidades</option>
                        <option value="Company">Empresa</option>
                        <option value="User">Usuário</option>
                        <option value="Plan">Plano</option>
                        <option value="Project">Projeto</option>
                        <option value="SYSTEM">Sistema</option>
                    </select>
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl text-xs py-2 px-2.5 focus:ring-2 focus:ring-emerald-500"
                        title="Data inicial"
                    />
                    <span className="text-xs text-slate-400">→</span>
                    <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl text-xs py-2 px-2.5 focus:ring-2 focus:ring-emerald-500"
                        title="Data final"
                    />
                    {hasFilters && (
                        <button
                            onClick={clearFilters}
                            className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline-offset-2 hover:underline px-2"
                        >
                            Limpar
                        </button>
                    )}
                </div>

                <div className="text-xs text-slate-400 font-medium">
                    Exibindo {visibleLogs.length} {search && `(filtrado)`} de {total.toLocaleString('pt-BR')} registros
                </div>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                {loading ? (
                    <div className="p-12 flex items-center justify-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : visibleLogs.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum log encontrado com os filtros atuais.</p>
                        {hasFilters && (
                            <button onClick={clearFilters} className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 font-bold">Limpar filtros</button>
                        )}
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#f9fafb]/50 dark:bg-[#151820]/50 text-slate-500 font-semibold uppercase text-xs tracking-wider sticky top-0">
                            <tr>
                                <th className="px-6 py-4">Quando</th>
                                <th className="px-6 py-4">Quem</th>
                                <th className="px-6 py-4">O quê</th>
                                <th className="px-6 py-4">Onde</th>
                                <th className="px-6 py-4">Detalhes</th>
                                <th className="px-6 py-4 text-right w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {visibleLogs.map(log => {
                                const v = verbOf(log.action);
                                const style = v ? ACTION_STYLE[v] : null;
                                const expanded = expandedId === log.id;
                                return (
                                    <React.Fragment key={log.id}>
                                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => setExpandedId(expanded ? null : log.id)}>
                                            <td className="px-6 py-3 text-slate-500 text-xs whitespace-nowrap">
                                                <div className="font-mono">{new Date(log.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                                                {log.ipAddress && <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{log.ipAddress}</div>}
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="font-medium text-slate-900 dark:text-white text-xs">{log.user?.username || 'Sistema'}</div>
                                                {log.user?.role && <div className="text-[10px] text-slate-400">{log.user.role}</div>}
                                            </td>
                                            <td className="px-6 py-3">
                                                {style ? (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${style.bg} ${style.text}`}>
                                                        {style.icon}
                                                        {style.label}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-mono text-slate-600 dark:text-slate-300">
                                                        {log.action}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-slate-700 dark:text-slate-300 text-xs">
                                                <div className="font-bold">{entityLabel(log.entity)}</div>
                                                {log.entityId && <div className="text-[10px] text-slate-400 font-mono">#{log.entityId.slice(0, 8)}</div>}
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="text-xs text-slate-600 dark:text-slate-400 max-w-[300px] truncate" title={formatDetails(log.details)}>
                                                    {formatDetails(log.details)}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                            </td>
                                        </tr>
                                        {expanded && (
                                            <tr className="bg-[#f9fafb]/50 dark:bg-[#151820]/50">
                                                <td colSpan={6} className="px-6 py-4">
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider shrink-0">JSON</span>
                                                        <pre className="text-[11px] text-slate-700 dark:text-slate-300 font-mono bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg p-3 overflow-auto max-h-60 w-full">
{JSON.stringify(log.details, null, 2)}
                                                        </pre>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Carregar mais */}
            {!loading && logs.length < total && (
                <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700/30 flex items-center justify-between bg-[#f9fafb]/50 dark:bg-[#151820]/50">
                    <span className="text-xs text-slate-500">{logs.length} carregados de {total}</span>
                    <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="px-3 py-1.5 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 hover:border-emerald-400 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                        {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        Carregar mais
                    </button>
                </div>
            )}
        </div>
    );
};
