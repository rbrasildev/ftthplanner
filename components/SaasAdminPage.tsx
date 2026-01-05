
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '../ThemeContext';
import { LogOut, LayoutDashboard, Building2, CreditCard, ChevronRight, CheckCircle2, AlertTriangle, Search, Network, Settings, BarChart3, X } from 'lucide-react';
import * as saasService from '../services/saasService';
import { SaasAnalytics } from './SaasAnalytics';

interface Company {
    id: string;
    name: string;
    status: string;
    plan?: { id: string; name: string; price: number };
    _count: { projects: number; users: number };
    createdAt: string;
}

export const SaasAdminPage: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeView, setActiveView] = useState<'dashboard' | 'companies' | 'plans' | 'audit' | 'analytics'>('dashboard');
    const [plans, setPlans] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    // ... (omitted) ...

    const navItems = [
        { id: 'dashboard', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
        { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
        { id: 'companies', label: 'Companies', icon: <Building2 className="w-5 h-5" /> },
        { id: 'plans', label: 'SaaS Plans', icon: <CreditCard className="w-5 h-5" /> },
        { id: 'audit', label: 'Audit Logs', icon: <Settings className="w-5 h-5" /> },
    ];
    const [editingPlan, setEditingPlan] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, [activeView]);

    const loadData = async () => {
        try {
            if (activeView === 'audit') {
                const logs = await saasService.getAuditLogs({ limit: 50 });
                setAuditLogs(logs);
            } else {
                const [companiesData, plansData] = await Promise.all([
                    saasService.getCompanies(),
                    saasService.getPlans()
                ]);
                setCompanies(companiesData);
                setPlans(plansData);
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCompanyUpdate = async (id: string, updates: { status?: string; planId?: string }) => {
        try {
            await saasService.updateCompany(id, updates);
            loadData(); // Re-fetch to update UI
        } catch (error) {
            alert('Failed to update company');
        }
    };

    const handleSavePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        const data = {
            name: formData.get('name'),
            price: parseFloat(formData.get('price') as string),
            limits: {
                maxProjects: formData.get('maxProjects') ? parseInt(formData.get('maxProjects') as string) : null,
                maxUsers: formData.get('maxUsers') ? parseInt(formData.get('maxUsers') as string) : null,
                maxCTOs: formData.get('maxCTOs') ? parseInt(formData.get('maxCTOs') as string) : null,
                maxPOPs: formData.get('maxPOPs') ? parseInt(formData.get('maxPOPs') as string) : null,
            }
        };

        try {
            if (editingPlan) {
                await saasService.updatePlan(editingPlan.id, data);
            } else {
                await saasService.createPlan(data);
            }
            loadData();
            setIsPlanModalOpen(false);
            setEditingPlan(null);
        } catch (error) {
            alert('Failed to save plan');
        }
    };

    const openPlanModal = (plan?: any) => {
        setEditingPlan(plan || null);
        setIsPlanModalOpen(true);
    };

    if (loading && activeView === 'dashboard') return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500">Loading platform data...</div>;

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-xl">
                <div className="p-6 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/50">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 text-white">
                        <Network className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight">FTTH Master</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Super Admin</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id as any)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeView === item.id
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                                } `}
                        >
                            {item.icon}
                            {item.label}
                            {activeView === item.id && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl text-sm font-medium transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto relative">
                <header className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md px-8 py-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white capitalize">{activeView === 'audit' ? 'Audit Logs' : activeView}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your platform resources and subscriptions</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Administrator</p>
                            <p className="text-xs text-slate-400">super@ftthmaster.com</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold border-2 border-white dark:border-slate-800 shadow-sm">
                            S
                        </div>
                    </div>
                </header>

                <div className="px-8 pb-12">
                    {activeView === 'dashboard' && (
                        <div className="space-y-8">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                                            <Building2 className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500">Total</span>
                                    </div>
                                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">{companies.length}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Registered Companies</p>
                                </div>

                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                                            <CheckCircle2 className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-bold px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg">Active</span>
                                    </div>
                                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">{companies.filter(c => c.status === 'ACTIVE').length}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Active Subscriptions</p>
                                </div>

                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                                            <CreditCard className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500">Monthly</span>
                                    </div>
                                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                                        ${companies.reduce((acc, c) => acc + (c.plan?.price || 0), 0).toFixed(2)}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Estimated MRR</p>
                                </div>
                            </div>

                            {/* Recent Activity / Simplified Table for Dashboard */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                    <h3 className="font-bold text-lg">Recent Companies</h3>
                                    <button onClick={() => setActiveView('companies')} className="text-sm text-indigo-600 hover:text-indigo-500 font-medium hover:underline">View All</button>
                                </div>
                                <div className="p-6">
                                    <table className="w-full text-left text-sm">
                                        <thead className="text-slate-400 font-medium text-xs uppercase tracking-wider">
                                            <tr>
                                                <th className="pb-3">Company</th>
                                                <th className="pb-3">Plan</th>
                                                <th className="pb-3 text-right">Joined</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {companies.slice(0, 5).map(c => (
                                                <tr key={c.id}>
                                                    <td className="py-3 font-medium text-slate-700 dark:text-slate-300">{c.name}</td>
                                                    <td className="py-3">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                                                            {c.plan?.name || 'No Plan'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-right text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === 'companies' && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="relative w-full sm:w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" placeholder="Search companies..." className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                                </div>
                                <div className="text-sm text-slate-500">
                                    Showing <span className="font-bold text-slate-900 dark:text-white">{companies.length}</span> results
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50/50 dark:bg-slate-950/50 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Company Name</th>
                                            <th className="px-6 py-4">Current Plan</th>
                                            <th className="px-6 py-4 text-center">Projects</th>
                                            <th className="px-6 py-4 text-center">Users</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {companies.map(company => (
                                            <tr key={company.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <div className="font-bold text-slate-900 dark:text-white">{company.name}</div>
                                                        <div className="text-xs text-slate-500">ID: {company.id.slice(0, 8)}...</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <select
                                                        value={company.plan?.id || ''}
                                                        onChange={(e) => handleCompanyUpdate(company.id, { planId: e.target.value })}
                                                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg py-1.5 pl-3 pr-8 focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm disabled:opacity-50"
                                                    >
                                                        <option value="" disabled>Select Plan</option>
                                                        {plans.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-medium">{company._count.projects}</td>
                                                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-medium">{company._count.users}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline - flex items - center gap - 1.5 px - 2.5 py - 1 rounded - full text - xs font - bold border shadow - sm ${company.status === 'ACTIVE'
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                                                        } `}>
                                                        {company.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                                        {company.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {company.status === 'ACTIVE' ? (
                                                        <button
                                                            onClick={() => handleCompanyUpdate(company.id, { status: 'SUSPENDED' })}
                                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-transparent hover:border-red-200 dark:hover:border-red-800"
                                                        >
                                                            Suspend Access
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleCompanyUpdate(company.id, { status: 'ACTIVE' })}
                                                            className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                                                        >
                                                            Reactivate
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeView === 'plans' && (
                        <div>
                            <div className="flex justify-end mb-6">
                                <button
                                    onClick={() => openPlanModal()}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                                >
                                    <CreditCard className="w-4 h-4" />
                                    Create New Plan
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {plans.map(plan => (
                                    <div key={plan.id} className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-6 flex flex-col relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <CreditCard className="w-24 h-24 text-indigo-500 rotate-12 transform translate-x-4 -translate-y-4" />
                                        </div>

                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 relative">{plan.name}</h3>
                                        <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2 mb-6 relative">
                                            {plan.price === 0 ? 'Free' : `R$ ${plan.price.toFixed(2)} `}
                                            <span className="text-sm font-medium text-slate-400 ml-1">/mo</span>
                                        </p>

                                        <div className="space-y-4 flex-1 relative z-10">
                                            <div className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800">
                                                <span className="text-slate-500 dark:text-slate-400">Projects</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{plan.limits?.maxProjects === null ? 'Unlimited' : plan.limits?.maxProjects}</span>
                                            </div>
                                            <div className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800">
                                                <span className="text-slate-500 dark:text-slate-400">Users</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{plan.limits?.maxUsers === null ? 'Unlimited' : plan.limits?.maxUsers}</span>
                                            </div>
                                            <div className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800">
                                                <span className="text-slate-500 dark:text-slate-400">CTOs</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{plan.limits?.maxCTOs === null ? 'Unlimited' : plan.limits?.maxCTOs}</span>
                                            </div>
                                            <div className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800">
                                                <span className="text-slate-500 dark:text-slate-400">POPs</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{plan.limits?.maxPOPs === null ? 'Unlimited' : plan.limits?.maxPOPs}</span>
                                            </div>
                                        </div>

                                        <div className="mt-8 pt-4">
                                            <button
                                                onClick={() => openPlanModal(plan)}
                                                className="w-full py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl text-sm font-bold transition-all border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700"
                                            >
                                                Edit Configuration
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeView === 'audit' && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                                <h3 className="font-bold text-lg">System Audit Log</h3>
                                <p className="text-sm text-slate-500">Immutable record of all administrative actions.</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50/50 dark:bg-slate-950/50 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Time</th>
                                            <th className="px-6 py-4">User</th>
                                            <th className="px-6 py-4">Action</th>
                                            <th className="px-6 py-4">Entity</th>
                                            <th className="px-6 py-4">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {auditLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 font-medium">
                                                    {log.user?.username || 'System'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">
                                                    {log.entity} <span className="text-xs opacity-50">#{log.entityId.slice(0, 6)}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <code className="text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-950 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-800 block w-full max-w-[200px] truncate">
                                                        {JSON.stringify(log.details)}
                                                    </code>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeView === 'analytics' && <SaasAnalytics />}
                </div>
                {isPlanModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <form onSubmit={handleSavePlan}>
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        {editingPlan ? 'Edit SaaS Plan' : 'Create New Plan'}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setIsPlanModalOpen(false)}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plan Name</label>
                                        <input
                                            name="name"
                                            defaultValue={editingPlan?.name}
                                            required
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="e.g. Pro, Enterprise"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monthly Price ($)</label>
                                        <input
                                            name="price"
                                            type="number"
                                            step="0.01"
                                            defaultValue={editingPlan?.price}
                                            required
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>

                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Resource Limits (Leave empty for Unlimited)</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Max Projects</label>
                                                <input
                                                    name="maxProjects"
                                                    type="number"
                                                    defaultValue={editingPlan?.limits?.maxProjects ?? ''}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Max Users</label>
                                                <input
                                                    name="maxUsers"
                                                    type="number"
                                                    defaultValue={editingPlan?.limits?.maxUsers ?? ''}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Max CTOs</label>
                                                <input
                                                    name="maxCTOs"
                                                    type="number"
                                                    defaultValue={editingPlan?.limits?.maxCTOs ?? ''}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Max POPs</label>
                                                <input
                                                    name="maxPOPs"
                                                    type="number"
                                                    defaultValue={editingPlan?.limits?.maxPOPs ?? ''}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsPlanModalOpen(false)}
                                        className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-600/20 transition-all"
                                    >
                                        Save Plan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};
