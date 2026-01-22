
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { useTheme } from '../../ThemeContext';
import { LogOut, LayoutDashboard, Building2, CreditCard, ChevronRight, CheckCircle2, AlertTriangle, Search, Network, Settings, BarChart3, X, Trash2, Users, Shield, Lock, RotateCcw, Eye, Activity, Zap, Server, Clock } from 'lucide-react';
import * as saasService from '../../services/saasService';
import { SaasAnalytics } from './SaasAnalytics';
import { ChangePasswordModal } from '../modals/ChangePasswordModal';

interface Company {
    id: string;
    name: string;
    status: string;
    plan?: {
        id: string;
        name: string;
        price: number;
        limits: {
            maxProjects?: number;
            maxUsers?: number;
            maxCTOs?: number;
            maxPOPs?: number;
        }
    };
    _count: { projects: number; users: number; ctos?: number; pops?: number };
    createdAt: string;
    users: { id: string; username: string; role: string }[];
    projects: { id: string; name: string }[];
    subscriptionExpiresAt?: string;
}

interface Plan {
    id: string;
    name: string;
    price: number;
    limits: {
        maxProjects?: number;
        maxUsers?: number;
        maxCTOs?: number;
        maxPOPs?: number;
    };

    features?: string[];
    isRecommended?: boolean;
    priceYearly?: number;
}

interface User {
    id: string;
    username: string;
    email?: string;
    role: string;
    active: boolean;
    companyId?: string;
    company?: { id: string; name: string };
    createdAt: string;
}

export const SaasAdminPage: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeView, setActiveView] = useState<'dashboard' | 'companies' | 'plans' | 'audit' | 'analytics' | 'users'>('dashboard');
    const [plans, setPlans] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [planFilter, setPlanFilter] = useState('ALL');

    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

    const filteredCompanies = companies.filter(company => {
        const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            company.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || company.status === statusFilter;
        const matchesPlan = planFilter === 'ALL' || company.plan?.id === planFilter;
        return matchesSearch && matchesStatus && matchesPlan;
    });

    const getUsagePercentage = (current: number, max: number | undefined) => {
        if (!max || max >= 999999) return 0;
        return Math.min(Math.round((current / max) * 100), 100);
    };

    const UsageBar = ({ label, current, max, color }: { label: string, current: number, max: number | undefined, color: string }) => {
        const percent = getUsagePercentage(current, max);
        const isUnlimited = !max || max >= 999999;

        return (
            <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-500 uppercase">{label}</span>
                    <span className={percent > 90 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}>
                        {current} / {isUnlimited ? '∞' : max}
                    </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${color}`}
                        style={{ width: `${isUnlimited ? 0 : percent}%` }}
                    />
                </div>
            </div>
        );
    };
    // ... (omitted) ...

    const navItems = [
        { id: 'dashboard', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
        { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
        { id: 'companies', label: 'Companies', icon: <Building2 className="w-5 h-5" /> },
        { id: 'users', label: 'Users', icon: <Users className="w-5 h-5" /> },
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
            } else if (activeView === 'users') {
                const usersData = await saasService.getUsers();
                setUsers(usersData);
            } else {
                const promises: Promise<any>[] = [
                    saasService.getCompanies(),
                    saasService.getPlans()
                ];

                if (activeView === 'dashboard') {
                    promises.push(saasService.getAuditLogs({ limit: 10 }));
                }

                const results = await Promise.all(promises);
                setCompanies(results[0]);
                setPlans(results[1]);
                if (activeView === 'dashboard' && results[2]) {
                    setAuditLogs(results[2]);
                }
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCompanyUpdate = async (id: string, updates: { status?: string; planId?: string; billingMode?: string }) => {
        try {
            const updatedCompany = await saasService.updateCompany(id, updates);
            loadData(); // Re-fetch to update UI list

            // If the updated company is the one currently selected, sync the detail view
            if (selectedCompany && selectedCompany.id === id) {
                // We merge carefully to avoid losing _count or other nested data not returned by basic update
                setSelectedCompany(prev => prev ? { ...prev, ...updatedCompany } : null);
            }
        } catch (error) {
            console.error('Update attempt failed:', error);
            alert('Failed to update company');
        }
    };

    const handleUserUpdate = async (id: string, updates: any) => {
        try {
            await saasService.updateUser(id, updates);
            alert('User updated successfully');
            loadData();
        } catch (error) {
            console.error(error);
            alert('Failed to update user');
        }
    };

    const handleCompanyDelete = (company: Company) => {
        setCompanyToDelete(company);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteCompany = async () => {
        if (!companyToDelete) return;

        try {
            await saasService.deleteCompany(companyToDelete.id);
            setCompanies(prev => prev.filter(c => c.id !== companyToDelete.id));
            loadData();
        } catch (error: any) {
            console.error("Delete failed", error);
            const msg = error.response?.data?.details || error.response?.data?.error || 'Failed to delete company';
            alert(msg);
        } finally {
            setIsDeleteModalOpen(false);
            setCompanyToDelete(null);
        }
    };

    const handleSavePlan = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const featuresText = formData.get('features') as string;
        const featuresValid = featuresText ? featuresText.split('\n').filter(s => s.trim()) : [];

        const planData = {
            name: formData.get('name'),
            price: parseFloat(formData.get('price') as string),
            priceYearly: formData.get('priceYearly') ? parseFloat(formData.get('priceYearly') as string) : null,
            type: formData.get('type') || 'STANDARD',
            trialDurationDays: formData.get('trialDurationDays') ? parseInt(formData.get('trialDurationDays') as string) : null,
            features: featuresValid,
            isRecommended: formData.get('isRecommended') === 'on',
            active: formData.get('active') === 'on',
            mercadopagoId: formData.get('mercadopagoId') as string,
            stripeId: formData.get('stripeId') as string,
            description: formData.get('description') as string,
            limits: {
                maxProjects: formData.get('maxProjects') ? parseInt(formData.get('maxProjects') as string) : 999999,
                maxUsers: formData.get('maxUsers') ? parseInt(formData.get('maxUsers') as string) : 999999,
                maxCTOs: formData.get('maxCTOs') ? parseInt(formData.get('maxCTOs') as string) : 999999,
                maxPOPs: formData.get('maxPOPs') ? parseInt(formData.get('maxPOPs') as string) : 999999
            }
        };
        try {
            if (editingPlan) {
                await saasService.updatePlan(editingPlan.id, planData);
            } else {
                await saasService.createPlan(planData);
            }
            await loadData();
            setIsPlanModalOpen(false);
            setEditingPlan(null);
        } catch (error) {
            alert('Failed to save plan');
        }
    };

    const openPlanModal = (plan?: any) => {
        if (plan) {
            let features = plan.features;
            if (typeof features === 'string') {
                try {
                    features = JSON.parse(features);
                } catch (e) {
                    features = [];
                }
            }
            if (!Array.isArray(features)) features = [];
            setEditingPlan({ ...plan, features });
        } else {
            setEditingPlan({ features: [], isRecommended: false });
        }
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
                        <button
                            onClick={() => setIsPasswordModalOpen(true)}
                            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors shadow-sm"
                        >
                            <Lock className="w-3 h-3" />
                            Change Password
                        </button>
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

                            {/* Platform Health & Activity Feed */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left Column: Health Metrics & Quick Actions */}
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                            <Activity className="w-5 h-5 text-indigo-500" />
                                            Platform Health
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                                        <Zap className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-500 uppercase">Total Projects</p>
                                                        <p className="font-bold text-slate-900 dark:text-white">{companies.reduce((acc, c) => acc + (c._count.projects || 0), 0)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                                        <Server className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-500 uppercase">Avg. Size</p>
                                                        <p className="font-bold text-slate-900 dark:text-white">
                                                            {(companies.reduce((acc, c) => acc + (c._count.projects || 0), 0) / (companies.length || 1)).toFixed(1)} <span className="text-xs font-normal text-slate-400">proj/sub</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Capacity Alerts Section */}
                                    {companies.filter(c => {
                                        const p = getUsagePercentage(c._count.projects, c.plan?.limits?.maxProjects);
                                        const u = getUsagePercentage(c._count.users, c.plan?.limits?.maxUsers);
                                        const ct = getUsagePercentage(c._count.ctos || 0, c.plan?.limits?.maxCTOs);
                                        return p > 80 || u > 80 || ct > 80;
                                    }).length > 0 && (
                                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 p-4 shadow-sm animate-in fade-in slide-in-from-left duration-500">
                                                <h3 className="font-bold text-sm text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                                                    <AlertTriangle className="w-4 h-4" />
                                                    Capacity Alerts
                                                </h3>
                                                <div className="space-y-2">
                                                    {companies.filter(c => {
                                                        const p = getUsagePercentage(c._count.projects, c.plan?.limits?.maxProjects);
                                                        const u = getUsagePercentage(c._count.users, c.plan?.limits?.maxUsers);
                                                        const ct = getUsagePercentage(c._count.ctos || 0, c.plan?.limits?.maxCTOs);
                                                        return p > 80 || u > 80 || ct > 80;
                                                    }).slice(0, 5).map(c => (
                                                        <div key={c.id} className="text-[11px] flex justify-between items-center bg-white/50 dark:bg-slate-900/50 p-2 rounded-lg group cursor-pointer hover:bg-white dark:hover:bg-slate-900 transition-all border border-transparent hover:border-amber-200" onClick={() => setSelectedCompany(c)}>
                                                            <span className="font-bold text-slate-700 dark:text-slate-200 truncate pr-2">{c.name}</span>
                                                            <span className="shrink-0 text-[10px] text-amber-600 font-bold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 rounded">Near Limit</span>
                                                        </div>
                                                    ))}
                                                    <button onClick={() => setActiveView('companies')} className="w-full text-center text-[10px] text-amber-600 font-bold hover:underline mt-2">View all companies &rarr;</button>
                                                </div>
                                            </div>
                                        )}

                                    {/* Action Banner */}
                                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group cursor-pointer" onClick={() => setActiveView('companies')}>
                                        <div className="relative z-10">
                                            <h3 className="font-bold text-lg mb-1">Manage Companies</h3>
                                            <p className="text-indigo-100 text-sm mb-4">View details, update limits, or suspend access.</p>
                                            <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-bold transition-all">Go to Companies &rarr;</button>
                                        </div>
                                        <Building2 className="absolute -bottom-4 -right-4 w-32 h-32 text-indigo-500/30 group-hover:scale-110 transition-transform duration-500" />
                                    </div>
                                </div>

                                {/* Right Column: Activity Feed */}
                                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                                    <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
                                        <div>
                                            <h3 className="font-bold text-lg">Live Activity Feed</h3>
                                            <p className="text-xs text-slate-500">Real-time system events and audit logs</p>
                                        </div>
                                        <button onClick={() => setActiveView('audit')} className="text-xs text-indigo-600 hover:text-indigo-500 font-bold uppercase tracking-wider hover:underline">View History</button>
                                    </div>
                                    <div className="flex-1 overflow-auto max-h-[400px] p-0">
                                        {auditLogs.length === 0 ? (
                                            <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                                                <Activity className="w-12 h-12 mb-3 opacity-20" />
                                                <p>No recent activity recorded.</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {auditLogs.map((log, idx) => (
                                                    <div key={log.id || idx} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex gap-4 items-start group">
                                                        <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${log.action?.includes('CREATE') ? 'bg-emerald-100 text-emerald-600' :
                                                            log.action?.includes('DELETE') ? 'bg-red-100 text-red-600' :
                                                                log.action?.includes('UPDATE') ? 'bg-blue-100 text-blue-600' :
                                                                    'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {log.action?.includes('CREATE') ? <Zap className="w-4 h-4" /> :
                                                                log.action?.includes('DELETE') ? <Trash2 className="w-4 h-4" /> :
                                                                    log.action?.includes('UPDATE') ? <RotateCcw className="w-4 h-4" /> :
                                                                        <Activity className="w-4 h-4" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start">
                                                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                                    <span className="font-bold">{log.user?.username || 'System'}</span>
                                                                    <span className="text-slate-500 font-normal"> {log.action.toLowerCase().replace('_', ' ')} </span>
                                                                    <span className="font-bold text-slate-700 dark:text-slate-300">{log.entity}</span>
                                                                </p>
                                                                <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                                                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                                                {log.details ? JSON.stringify(log.details).replace(/"/g, '').replace(/[{}]/g, '') : 'No details'}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 mt-1">
                                                                {new Date(log.createdAt).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === 'companies' && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-center gap-4">
                                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search name or ID..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold py-2 pl-3 pr-8 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                        >
                                            <option value="ALL">All Status</option>
                                            <option value="ACTIVE">Active</option>
                                            <option value="SUSPENDED">Suspended</option>
                                        </select>
                                        <select
                                            value={planFilter}
                                            onChange={(e) => setPlanFilter(e.target.value)}
                                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold py-2 pl-3 pr-8 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                        >
                                            <option value="ALL">All Plans</option>
                                            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="text-sm text-slate-500">
                                    Showing <span className="font-bold text-slate-900 dark:text-white">{filteredCompanies.length}</span> results
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
                                        {filteredCompanies.map(company => (
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
                                                <td className="px-6 py-4">
                                                    <div className="w-48 space-y-2">
                                                        <UsageBar
                                                            label="Projects"
                                                            current={company._count.projects}
                                                            max={company.plan?.limits?.maxProjects}
                                                            color="bg-indigo-500"
                                                        />
                                                        <UsageBar
                                                            label="CTOs"
                                                            current={company._count.ctos || 0}
                                                            max={company.plan?.limits?.maxCTOs}
                                                            color="bg-blue-500"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="w-32">
                                                        <UsageBar
                                                            label="Users"
                                                            current={company._count.users}
                                                            max={company.plan?.limits?.maxUsers}
                                                            color="bg-emerald-500"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm ${company.status === 'ACTIVE'
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                                        : company.status === 'TRIAL'
                                                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                                                            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                                                        }`}>
                                                        {company.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : company.status === 'TRIAL' ? <Clock className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
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
                                                    <button
                                                        onClick={() => setSelectedCompany(company)}
                                                        className="ml-2 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-2 rounded-lg transition-colors"
                                                        title="Quick View"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleCompanyDelete(company)}
                                                        className="ml-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                                                        title="Delete Company"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
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
                                    <div key={plan.id} className={`bg-white dark:bg-slate-900 rounded-3xl p-8 border hover:shadow-2xl transition-all relative ${plan.isRecommended ? 'border-indigo-500 ring-4 ring-indigo-500/10 scale-105 shadow-xl' : 'border-slate-200 dark:border-slate-800'}`}>
                                        {plan.isRecommended && (
                                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
                                                Most Popular
                                            </div>
                                        )}
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                                                <div className="mt-2 flex items-baseline gap-1">
                                                    <span className="text-4xl font-extrabold text-slate-900 dark:text-white">${plan.price}</span>
                                                    <span className="text-sm font-medium text-slate-500">/month</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => openPlanModal(plan)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                                                    <Settings className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-4 mb-8">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl space-y-3">
                                                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                                    <LayoutDashboard className="w-4 h-4 text-indigo-500" />
                                                    <span className="font-medium text-slate-900 dark:text-white">{(plan.limits?.maxProjects || 0) >= 999999 ? '∞' : plan.limits?.maxProjects || '∞'}</span> Max Projects
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                                    <Users className="w-4 h-4 text-emerald-500" />
                                                    <span className="font-medium text-slate-900 dark:text-white">{(plan.limits?.maxUsers || 0) >= 999999 ? '∞' : plan.limits?.maxUsers || '∞'}</span> Max Users
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                                    <Network className="w-4 h-4 text-blue-500" />
                                                    <span className="font-medium text-slate-900 dark:text-white">{(plan.limits?.maxCTOs || 0) >= 999999 ? '∞' : plan.limits?.maxCTOs || '∞'}</span> CTOs & POPs
                                                </div>
                                            </div>

                                            {/* Features List */}
                                            {/* Features List */}
                                            {(() => {
                                                let featuresList = plan.features;
                                                if (typeof featuresList === 'string') {
                                                    try {
                                                        featuresList = JSON.parse(featuresList);
                                                    } catch (e) {
                                                        featuresList = [];
                                                    }
                                                }

                                                if (!Array.isArray(featuresList)) featuresList = [];

                                                if (featuresList.length > 0) {
                                                    return (
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Included Features:</p>
                                                            {featuresList.map((feature: string, idx: number) => (
                                                                <div key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                                    <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                                                    <span>{feature}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>

                                        <button className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${plan.isRecommended
                                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25'
                                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-100 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500'
                                            }`}>
                                            Assign Plan
                                        </button>
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

                    {activeView === 'analytics' && <SaasAnalytics companies={companies} />}

                    {activeView === 'users' && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                <h3 className="font-bold text-lg">Platform Users</h3>
                                <div className="text-sm text-slate-500">
                                    Total: <span className="font-bold text-slate-900 dark:text-white">{users.length}</span>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50/50 dark:bg-slate-950/50 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">User</th>
                                            <th className="px-6 py-4">Company</th>
                                            <th className="px-6 py-4">Role</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {users.map(user => (
                                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${user.role === 'OWNER' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {user.username.slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-slate-900 dark:text-white">{user.username}</div>
                                                            <div className="text-xs text-slate-500">ID: {user.id.slice(0, 8)}...</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {user.company ? (
                                                        <div className="text-slate-700 dark:text-slate-300 font-medium text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded inline-block">
                                                            {user.company.name}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic">No Company</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <select
                                                        value={user.role}
                                                        onChange={(e) => handleUserUpdate(user.id, { role: e.target.value })}
                                                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs rounded py-1 px-2"
                                                        disabled={user.role === 'SUPER_ADMIN'}
                                                    >
                                                        <option value="OWNER">Owner</option>
                                                        <option value="ADMIN">Admin</option>
                                                        <option value="EDITOR">Editor</option>
                                                        <option value="VIEWER">Viewer</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.active
                                                        ? 'bg-emerald-50 text-emerald-600'
                                                        : 'bg-red-50 text-red-600'
                                                        }`}>
                                                        {user.active ? 'Active' : 'Blocked'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const newPass = prompt("Enter new password for " + user.username);
                                                            if (newPass) handleUserUpdate(user.id, { password: newPass });
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                        title="Reset Password"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                    {user.active ? (
                                                        <button
                                                            onClick={() => handleUserUpdate(user.id, { active: false })}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                            title="Block Access"
                                                        >
                                                            <Lock className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleUserUpdate(user.id, { active: true })}
                                                            className="p-1.5 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                            title="Unblock"
                                                        >
                                                            <Shield className="w-4 h-4" />
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
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Yearly Price ($)</label>
                                        <input
                                            name="priceYearly"
                                            type="number"
                                            step="0.01"
                                            defaultValue={editingPlan?.priceYearly}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plan Type</label>
                                            <select
                                                name="type"
                                                defaultValue={editingPlan?.type || 'STANDARD'}
                                                onChange={(e) => {
                                                    const trialInput = document.getElementById('trialDurationInput');
                                                    if (trialInput) {
                                                        if (e.target.value === 'TRIAL') {
                                                            trialInput.classList.remove('hidden');
                                                        } else {
                                                            trialInput.classList.add('hidden');
                                                        }
                                                    }
                                                }}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="STANDARD">Standard (Paid)</option>
                                                <option value="TRIAL">Trial (Free/Time Limited)</option>
                                                <option value="ENTERPRISE">Enterprise (Custom)</option>
                                            </select>
                                        </div>
                                        <div id="trialDurationInput" className={editingPlan?.type === 'TRIAL' ? '' : 'hidden'}>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Trial Duration (Days)</label>
                                            <input
                                                name="trialDurationDays"
                                                type="number"
                                                defaultValue={editingPlan?.trialDurationDays || 7}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mercado Pago ID</label>
                                            <input
                                                name="mercadopagoId"
                                                defaultValue={editingPlan?.mercadopagoId || ''}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                                                placeholder="e.g. 2c938084..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stripe Price ID</label>
                                            <input
                                                name="stripeId"
                                                defaultValue={editingPlan?.stripeId || ''}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                                                placeholder="e.g. price_1Hh..."
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description (Internal)</label>
                                        <textarea
                                            name="description"
                                            rows={2}
                                            defaultValue={editingPlan?.description || ''}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Plan description..."
                                        />
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                            <input
                                                type="checkbox"
                                                name="active"
                                                defaultChecked={editingPlan?.active ?? true}
                                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                            />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Active (Visible to users)</span>
                                        </label>
                                    </div>



                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Resource Limits (Leave empty for Unlimited)</h4>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
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

                                        <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <div>
                                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        name="isRecommended"
                                                        defaultChecked={editingPlan?.isRecommended}
                                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mark as Recommended Plan (Highlighted)</span>
                                                </label>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Features List (one per line)</label>
                                                <textarea
                                                    name="features"
                                                    rows={4}
                                                    placeholder="24/7 Support&#10;Daily Backups&#10;Advanced Analytics"
                                                    defaultValue={editingPlan?.features?.join('\n')}
                                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
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
                    </div >
                )}
                {/* Company Quick View Drawer */}
                {
                    selectedCompany && (
                        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm" onClick={() => setSelectedCompany(null)}>
                            <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto border-l border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedCompany.name}</h2>
                                        <p className="text-sm text-slate-500">ID: {selectedCompany.id}</p>
                                    </div>
                                    <button onClick={() => setSelectedCompany(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {/* Summary Card */}
                                    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Health & Usage</h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-4">
                                            <div>
                                                <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Plan info</p>
                                                <p className="font-bold text-slate-900 dark:text-white text-sm">{selectedCompany.plan?.name || 'No Plan'}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Status</p>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${selectedCompany.status === 'ACTIVE'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : selectedCompany.status === 'TRIAL'
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                    {selectedCompany.status}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Stripe & Expiration Info */}
                                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-slate-400 text-[10px] uppercase font-bold">Expires At</p>
                                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                        {selectedCompany.subscriptionExpiresAt
                                                            ? new Date(selectedCompany.subscriptionExpiresAt).toLocaleDateString()
                                                            : 'No expiration'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 text-[10px] uppercase font-bold">Billing Mode</p>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                                                        Manual
                                                    </p>
                                                </div>
                                            </div>

                                        </div>

                                        <div className="space-y-3 mt-4">
                                            <UsageBar
                                                label="Projects"
                                                current={selectedCompany._count.projects}
                                                max={selectedCompany.plan?.limits?.maxProjects}
                                                color="bg-indigo-500"
                                            />
                                            <UsageBar
                                                label="Users"
                                                current={selectedCompany._count.users}
                                                max={selectedCompany.plan?.limits?.maxUsers}
                                                color="bg-emerald-500"
                                            />
                                            <UsageBar
                                                label="Infrastructure (CTOs)"
                                                current={selectedCompany._count.ctos || 0}
                                                max={selectedCompany.plan?.limits?.maxCTOs}
                                                color="bg-blue-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {selectedCompany.status === 'ACTIVE' ? (
                                            <button
                                                onClick={() => handleCompanyUpdate(selectedCompany.id, { status: 'SUSPENDED' })}
                                                className="flex items-center justify-center gap-2 py-2.5 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-xl text-xs font-bold border border-red-100 dark:border-red-900/50 hover:bg-red-100 transition-colors"
                                            >
                                                <Lock className="w-3.5 h-3.5" />
                                                Suspend
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleCompanyUpdate(selectedCompany.id, { status: 'ACTIVE' })}
                                                className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 rounded-xl text-xs font-bold border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100 transition-colors"
                                            >
                                                <Shield className="w-3.5 h-3.5" />
                                                Activate
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleCompanyDelete(selectedCompany)}
                                            className="flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Delete
                                        </button>
                                    </div>

                                    {/* Users List */}
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            Team Members <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">{selectedCompany.users?.length || 0}</span>
                                        </h3>
                                        <div className="space-y-2">
                                            {selectedCompany.users?.map(u => (
                                                <div key={u.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${u.role === 'OWNER' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {u.username.slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-sm text-slate-900 dark:text-white">{u.username}</p>
                                                            <p className="text-xs text-slate-400 uppercase">{u.role}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!selectedCompany.users || selectedCompany.users.length === 0) && (
                                                <p className="text-sm text-slate-400 italic">No users found.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Projects List */}
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            Projects <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">{selectedCompany.projects?.length || 0}</span>
                                        </h3>
                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                            {selectedCompany.projects?.map(p => (
                                                <div key={p.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg hover:border-indigo-300 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded">
                                                            <Network className="w-4 h-4" />
                                                        </div>
                                                        <p className="font-medium text-sm text-slate-900 dark:text-white">{p.name}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!selectedCompany.projects || selectedCompany.projects.length === 0) && (
                                                <p className="text-sm text-slate-400 italic">No projects found.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }


                <ChangePasswordModal
                    isOpen={isPasswordModalOpen}
                    onClose={() => setIsPasswordModalOpen(false)}
                />
            </main >
            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && companyToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all scale-100 p-8">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full mb-2">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Delete Company?</h3>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                <p>You are about to delete <span className="font-bold text-slate-800 dark:text-slate-200">{companyToDelete.name}</span>.</p>
                                <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/30 rounded-xl text-left border border-red-100 dark:border-red-900/50">
                                    <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">This will permanently delete:</p>
                                    <ul className="space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 bg-red-500 rounded-full"></div> All Projects & Networks</li>
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 bg-red-500 rounded-full"></div> {companyToDelete._count.users} Users accounts</li>
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 bg-red-500 rounded-full"></div> Active Subscriptions</li>
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 bg-red-500 rounded-full"></div> System Audit Logs</li>
                                    </ul>
                                </div>
                                <p className="mt-4 text-xs text-slate-400">This action cannot be undone.</p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteCompany}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
