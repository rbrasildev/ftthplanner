import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { AlertTriangle, TrendingUp, Users, HeartPulse, ShieldAlert, CheckCircle2, DollarSign, Bell, Mail, Filter, Search, EyeOff, Activity, Clock } from 'lucide-react';
import * as saasService from '../../services/saasService';

interface Alert {
    id: string;
    userId: string;
    type: string;
    severity: string;
    status: string;
    message: string;
    createdAt: string;
    user: { id: string; username: string; email: string };
}

interface UserRetentionData {
    id: string;
    username: string;
    email: string;
    company: string;
    lastLoginAt: string | null;
    churnRiskScore: number;
    estimatedLTV: number;
    monthlyRevenue: number;
    alerts: Alert[];
    hasProject: boolean;
    paymentFailed: boolean;
}

interface RetentionDashboardResponse {
    summary: {
        activeTodayPercent: number;
        highRiskPercent: number;
        neverCreatedProject: number;
        inactive7Days: number;
        revenueAtRisk: number;
        averageLTV: number;
        churnForcastNextMonth: number;
    };
    alerts: Alert[];
    users: UserRetentionData[];
}

export const SaasRetentionIntelligence: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<RetentionDashboardResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterRisk, setFilterRisk] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'LOW'>('ALL');
    const [filterNoProjects, setFilterNoProjects] = useState(false);
    const [filterPaymentFailed, setFilterPaymentFailed] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const response = await saasService.getRetentionDashboard();
            setData(response);
        } catch (error) {
            console.error('Failed to load retention data', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !data) {
        return <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
            <HeartPulse className="w-12 h-12 text-slate-200 animate-pulse mb-4" />
            <p>{t('retention_loading')}</p>
        </div>;
    }

    const { summary, alerts, users } = data;

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesRisk = true;
        if (filterRisk === 'CRITICAL') matchesRisk = user.churnRiskScore >= 80;
        else if (filterRisk === 'HIGH') matchesRisk = user.churnRiskScore >= 60 && user.churnRiskScore < 80;
        else if (filterRisk === 'LOW') matchesRisk = user.churnRiskScore < 40;

        const matchesNoProj = filterNoProjects ? !user.hasProject : true;
        const matchesPayment = filterPaymentFailed ? user.paymentFailed : true;

        return matchesSearch && matchesRisk && matchesNoProj && matchesPayment;
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <HeartPulse className="w-6 h-6 text-rose-500" />
                        {t('retention_title')}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t('retention_subtitle')}
                    </p>
                </div>
                <button onClick={loadData} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 transition-all flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    {t('retention_refresh_data')}
                </button>
            </div>

            {/* Top Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-6 rounded-2xl shadow-lg shadow-indigo-500/20 text-white">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-white/20 rounded-xl">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <h3 className="text-4xl font-extrabold">{summary.activeTodayPercent.toFixed(1)}%</h3>
                    <p className="text-indigo-100 mt-1 font-medium">{t('retention_active_today')}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600 dark:text-rose-400">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold px-2 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg">{t('retention_risk_badge', { val: summary.churnForcastNextMonth.toFixed(0) })}</span>
                    </div>
                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">{summary.highRiskPercent.toFixed(1)}%</h3>
                    <p className="text-sm text-slate-500 mt-1 font-medium text-slate-500 dark:text-slate-400">{t('retention_high_risk_churn')}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg">{t('retention_avg_ltv')}</span>
                    </div>
                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        $ {summary.averageLTV.toFixed(2)}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 font-medium text-slate-500 dark:text-slate-400">{t('retention_value_over_time')}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-red-500">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400">
                            <DollarSign className="w-6 h-6" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        $ {summary.revenueAtRisk.toFixed(2)}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 font-medium text-slate-500 dark:text-slate-400">{t('retention_revenue_at_risk')}</p>
                </div>
            </div>

            {/* Quick Insights Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4">
                <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                        <EyeOff className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.neverCreatedProject}</p>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-500">{t('retention_never_created_project')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                        <Clock className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.inactive7Days}</p>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-500">{t('retention_inactive_7_days')}</p>
                    </div>
                </div>
            </div>

            {/* Detailed Table & Alerts Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* Users Table */}
                <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-500" />
                                {t('retention_table_title')}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder={t('retention_search_placeholder')}
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 w-full md:w-64"
                                    />
                                </div>
                                <select
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium"
                                    value={filterRisk}
                                    onChange={e => setFilterRisk(e.target.value as any)}
                                >
                                    <option value="ALL">{t('retention_filter_risk_all')}</option>
                                    <option value="CRITICAL">{t('retention_filter_risk_critical')}</option>
                                    <option value="HIGH">{t('retention_filter_risk_high')}</option>
                                    <option value="LOW">{t('retention_filter_risk_low')}</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded text-indigo-600" checked={filterNoProjects} onChange={e => setFilterNoProjects(e.target.checked)} />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('retention_filter_no_projects')}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded text-red-600" checked={filterPaymentFailed} onChange={e => setFilterPaymentFailed(e.target.checked)} />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('retention_filter_payment_failed')}</span>
                            </label>
                        </div>
                    </div>

                    <div className="overflow-x-auto flex-1 h-96">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50/50 dark:bg-slate-950/50 text-slate-500 font-semibold uppercase text-xs tracking-wider sticky top-0 backdrop-blur">
                                <tr>
                                    <th className="px-4 py-3">{t('retention_th_client')}</th>
                                    <th className="px-4 py-3">{t('retention_th_risk')}</th>
                                    <th className="px-4 py-3">{t('retention_th_mrr_ltv')}</th>
                                    <th className="px-4 py-3">{t('retention_th_last_access')}</th>
                                    <th className="px-4 py-3">{t('retention_th_status_alerts')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{user.username}</div>
                                            <div className="text-xs text-slate-500 truncate max-w-[150px]">{user.company}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex justify-center items-center text-xs font-bold shadow-sm ${user.churnRiskScore >= 80 ? 'bg-rose-100 text-rose-700' : user.churnRiskScore >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                    {Math.round(user.churnRiskScore)}
                                                </div>
                                                <div className="w-20 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                                    <div
                                                        className={`h-full ${user.churnRiskScore >= 80 ? 'bg-rose-500' : user.churnRiskScore >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${user.churnRiskScore}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">${user.monthlyRevenue.toFixed(2)}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">LTV: ${user.estimatedLTV.toFixed(2)}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.lastLoginAt ? (
                                                <div className="text-xs">
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium block">{new Date(user.lastLoginAt).toLocaleDateString()}</span>
                                                    <span className="text-slate-500 text-[10px]">
                                                        {t('retention_days_ago', { val: Math.floor((new Date().getTime() - new Date(user.lastLoginAt).getTime()) / (1000 * 3600 * 24)) })}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">{t('retention_never_accessed')}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 space-y-1">
                                            {!user.hasProject && (
                                                <span className="inline-block px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded">{t('retention_no_project_badge')}</span>
                                            )}
                                            {user.paymentFailed && (
                                                <span className="inline-block px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold rounded mx-1">{t('retention_payment_failed_badge')}</span>
                                            )}
                                            {user.alerts.length > 0 && (
                                                <span className="inline-block px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded flex items-center gap-1 w-max">
                                                    <Bell className="w-3 h-3" /> {t('retention_alerts_badge', { val: user.alerts.length })}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                                            {t('retention_no_users_found')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Active Alerts Feed */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Bell className="w-5 h-5 text-indigo-500" />
                            {t('retention_alerts_title')}
                        </h3>
                        <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{alerts.length}</span>
                    </div>
                    <div className="overflow-y-auto max-h-[500px] pr-2 space-y-3">
                        {alerts.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-sm">{t('retention_no_recent_events')}</div>
                        ) : alerts.map(alert => (
                            <div key={alert.id} className={`p-3 rounded-xl border ${alert.severity === 'CRITICAL' ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${alert.severity === 'CRITICAL' ? 'bg-rose-200/50 text-rose-700' : 'bg-amber-200/50 text-amber-700'}`}>
                                        {alert.type.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight mb-2">{alert.message}</p>
                                <div className="flex items-center gap-2 text-xs">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-[8px] text-slate-600">
                                        {alert.user?.username?.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="text-slate-600 dark:text-slate-400 font-medium truncate">{alert.user?.username}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
