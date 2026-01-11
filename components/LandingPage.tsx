import React from 'react';
import { Network, ArrowRight, Shield, Zap, Globe, Users, Layers, CheckCircle2, Map as MapIcon, BarChart3, Lock, ChevronRight, Menu, X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface LandingPageProps {
    onLoginClick: () => void;
    onRegisterClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onRegisterClick }) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [plans, setPlans] = React.useState<any[]>([]);
    const { language, setLanguage, t } = useLanguage();

    React.useEffect(() => {
        const fetchPlans = async () => {
            try {
                // If in dev mode, assume local server; otherwise use relative path
                const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
                const res = await fetch(`${baseUrl}/api/saas/public/plans`);
                if (res.ok) {
                    const data = await res.json();
                    setPlans(data);
                }
            } catch (err) {
                console.error("Failed to load public plans", err);
            }
        };
        fetchPlans();
    }, []);

    return (
        <div className="h-full bg-slate-950 font-sans text-slate-100 overflow-y-auto overflow-x-hidden selection:bg-sky-500/30">

            {/* --- NAVBAR --- */}
            <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        {/* Logo */}
                        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
                            <div className="w-10 h-10 bg-sky-600 rounded-xl shadow-lg shadow-sky-600/20 flex items-center justify-center transform hover:scale-105 transition-transform">
                                <Network className="text-white w-6 h-6" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-xl tracking-tight leading-none text-white">{t('app_title')}</span>
                                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Planner Pro</span>
                            </div>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center space-x-8">
                            <a href="#features" className="text-sm font-semibold text-slate-300 hover:text-sky-400 transition-colors">{t('landing_features')}</a>
                            <a href="#pricing" className="text-sm font-semibold text-slate-300 hover:text-sky-400 transition-colors">{t('landing_pricing')}</a>
                            <a href="#performance" className="text-sm font-semibold text-slate-300 hover:text-sky-400 transition-colors">{t('landing_performance')}</a>
                            <a href="#how-it-works" className="text-sm font-semibold text-slate-300 hover:text-sky-400 transition-colors">{t('landing_how_it_works')}</a>
                        </div>

                        {/* Auth Buttons */}
                        <div className="hidden md:flex items-center gap-4">
                            <button
                                onClick={() => setLanguage(language === 'pt' ? 'en' : 'pt')}
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800 transition-colors"
                                title="Change Language"
                            >
                                <Globe className="w-5 h-5 text-slate-300" />
                                <span className="text-sm font-bold text-slate-300 uppercase">{language}</span>
                            </button>
                            <button
                                onClick={onLoginClick}
                                className="text-sm font-bold text-slate-300 hover:text-sky-400 transition-colors"
                            >
                                {t('landing_login')}
                            </button>
                            <button
                                onClick={onRegisterClick}
                                className="group bg-white text-slate-900 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {t('landing_get_started')}
                                <ArrowRight className="w-4 h-4 inline-block ml-2 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>

                        {/* Mobile Menu Toggle */}
                        <div className="md:hidden flex items-center">
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-300">
                                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="md:hidden absolute top-20 left-0 w-full bg-slate-950 border-b border-slate-800 p-4 shadow-xl flex flex-col space-y-4 animate-in slide-in-from-top-10">
                        <a href="#features" className="text-base font-semibold p-2" onClick={() => setIsMenuOpen(false)}>{t('landing_features')}</a>
                        <a href="#pricing" className="text-base font-semibold p-2" onClick={() => setIsMenuOpen(false)}>{t('landing_pricing')}</a>
                        <a href="#performance" className="text-base font-semibold p-2" onClick={() => setIsMenuOpen(false)}>{t('landing_performance')}</a>
                        <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
                            <button
                                onClick={() => { setLanguage(language === 'pt' ? 'en' : 'pt'); setIsMenuOpen(false); }}
                                className="w-full py-3 font-bold text-center border rounded-xl flex items-center justify-center gap-2"
                            >
                                <Globe className="w-5 h-5" />
                                <span className="uppercase">{language === 'pt' ? 'English' : 'Português'}</span>
                            </button>
                            <button onClick={() => { onLoginClick(); setIsMenuOpen(false); }} className="w-full py-3 font-bold text-center border rounded-xl">{t('landing_login')}</button>
                            <button onClick={() => { onRegisterClick(); setIsMenuOpen(false); }} className="w-full py-3 bg-sky-600 text-white font-bold rounded-xl shadow-lg">{t('landing_get_started')}</button>
                        </div>
                    </div>
                )}
            </nav>

            {/* --- HERO SECTION --- */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-0 right-0 -z-10 w-[800px] h-[800px] bg-sky-500/10 rounded-full blur-[120px] translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-0 -z-10 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px] -translate-x-1/3 translate-y-1/3"></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-900/30 border border-sky-800 text-sky-300 text-xs font-bold uppercase tracking-wider mb-8 animate-in fade-in zoom-in duration-700">
                        <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
                        {t('landing_hero_badge')}
                    </div>

                    <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 max-w-4xl mx-auto leading-[1.1]">
                        {t('landing_hero_title_1')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-600">{t('landing_hero_title_2')}</span> {t('landing_hero_title_3')}
                    </h1>

                    <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                        {t('landing_hero_desc')}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center mb-16">
                        <button
                            onClick={onRegisterClick}
                            className="w-full sm:w-auto px-8 py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-sky-600/30 transition-all transform hover:-translate-y-1 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                        >
                            {t('landing_start_trial')}
                            <ChevronRight className="w-5 h-5" />
                        </button>
                        <button
                            className="w-full sm:w-auto px-8 py-4 bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2"
                        >
                            <span className="relative flex h-3 w-3 mr-1">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            {t('landing_live_demo')}
                        </button>
                    </div>

                    {/* Dashboard Preview */}
                    <div className="relative w-full max-w-6xl mx-auto animate-in slide-in-from-bottom-20 fade-in duration-1000 delay-200">
                        <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
                            <img src="/dashboard-preview.png" alt="FTTH Planner Dashboard" className="w-full h-auto opacity-90 hover:opacity-100 transition-opacity duration-700" />
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-20"></div>
                        </div>
                        {/* Floating Badges */}
                        <div className="absolute -right-4 top-10 bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-700 hidden lg:flex items-center gap-3 animate-bounce-slow">
                            <div className="p-2 bg-emerald-900/50 rounded-lg text-emerald-400">
                                <MapIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-500 uppercase">{t('landing_map_engine')}</div>
                                <div className="text-sm font-bold">{t('landing_leaflet')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- PROBLEM SECTION --- */}
            <section className="py-24 bg-slate-900 border-y border-slate-800/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div className="space-y-6">
                            <h2 className="text-3xl font-bold text-white">
                                {t('landing_problem_title')} <span className="text-red-500 decoration-red-200 underline decoration-wavy underline-offset-4">{t('landing_problem_highlight')}</span>
                            </h2>
                            <p className="text-lg text-slate-400 leading-relaxed">
                                {t('landing_problem_desc')}
                            </p>
                            <ul className="space-y-4">
                                {[
                                    t('landing_problem_1'),
                                    t('landing_problem_2'),
                                    t('landing_problem_3'),
                                    t('landing_problem_4')
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-slate-300">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-900/30 flex items-center justify-center text-red-500">
                                            <X className="w-4 h-4" />
                                        </div>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-20 blur-[80px] rounded-full"></div>
                            <div className="relative bg-slate-950 p-8 rounded-3xl border border-slate-800 shadow-xl">
                                <div className="space-y-4 font-mono text-xs text-slate-400">
                                    <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                                    <div className="h-4 bg-slate-800 rounded w-full"></div>
                                    <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                                    <div className="h-4 bg-slate-800 rounded w-2/3"></div>
                                    <div className="h-4 bg-red-900/30 rounded w-full border border-red-900/50 flex items-center px-2 text-red-500">
                                        {t('landing_error_connection')}
                                    </div>
                                    <div className="h-4 bg-slate-800 rounded w-4/5"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- FEATURES GRID --- */}
            <section id="features" className="py-24 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -z-10 w-[1000px] h-[1000px] bg-sky-500/5 rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2"></div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">{t('landing_features_title')}</h2>
                        <p className="text-lg text-slate-400">{t('landing_features_desc')}</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <MapIcon className="w-6 h-6 text-white" />,
                                color: "bg-sky-500",
                                title: t('landing_feat_maps'),
                                desc: t('landing_feat_maps_desc')
                            },
                            {
                                icon: <Layers className="w-6 h-6 text-white" />,
                                color: "bg-indigo-500",
                                title: t('landing_feat_cable'),
                                desc: t('landing_feat_cable_desc')
                            },
                            {
                                icon: <Users className="w-6 h-6 text-white" />,
                                color: "bg-purple-500",
                                title: t('landing_feat_team'),
                                desc: t('landing_feat_team_desc')
                            },
                            {
                                icon: <Zap className="w-6 h-6 text-white" />,
                                color: "bg-amber-500",
                                title: t('landing_feat_snap'),
                                desc: t('landing_feat_snap_desc')
                            },
                            {
                                icon: <BarChart3 className="w-6 h-6 text-white" />,
                                color: "bg-emerald-500",
                                title: t('landing_feat_bom'),
                                desc: t('landing_feat_bom_desc')
                            },
                            {
                                icon: <Globe className="w-6 h-6 text-white" />,
                                color: "bg-rose-500",
                                title: t('landing_feat_import'),
                                desc: t('landing_feat_import_desc')
                            }
                        ].map((feature, idx) => (
                            <div key={idx} className="group p-8 bg-slate-900 rounded-3xl border border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center shadow-lg mb-6 group-hover:scale-110 transition-transform`}>
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                                <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- PRICING SECTION --- */}
            <section id="pricing" className="py-24 bg-slate-900 border-y border-slate-800 relative">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[120px] translate-x-1/2 -translate-y-1/2"></div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-900/30 border border-indigo-800 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-6">
                            Offer
                        </div>
                        <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">{t('pricing_title')}</h2>
                        <p className="text-lg text-slate-400">{t('pricing_desc')}</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {plans.length > 0 ? plans.map((plan, idx) => (
                            <div key={idx} className={`bg-slate-900 rounded-3xl border p-8 flex flex-col relative ${plan.isRecommended ? 'border-indigo-500 ring-4 ring-indigo-500/20 transform scale-105 z-10 shadow-2xl' : 'border-slate-800'}`}>
                                {plan.isRecommended && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                                        {t('most_popular')}
                                    </div>
                                )}
                                <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                                <div className="mb-6">
                                    <span className="text-3xl font-extrabold text-white">R$ {plan.price}</span>
                                    {plan.price > 0 && <span className="text-sm font-medium text-slate-400">{t('month')}</span>}
                                </div>
                                <div className="space-y-4 mb-8 flex-1">
                                    {/* Limits */}
                                    <div className="flex items-center gap-3 text-sm text-slate-300">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span>{(plan.limits?.maxProjects || 0) >= 999999 ? t('feature_unlimited').replace('Projects', '').trim() : plan.limits?.maxProjects} Projects</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-300">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span>{(plan.limits?.maxUsers || 0) >= 999999 ? t('feature_unlimited').replace('Users', '').trim() : plan.limits?.maxUsers} Users</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-300">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span>{(plan.limits?.maxCTOs || 0) >= 999999 ? t('feature_unlimited').replace('CTOs', '').trim() : plan.limits?.maxCTOs} CTOs</span>
                                    </div>


                                    {/* Features List */}
                                    {plan.features && Array.isArray(plan.features) && plan.features.map((feature: string, i: number) => (
                                        <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                                <button className={`w-full py-3 rounded-xl font-bold transition-all ${plan.isRecommended ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg hover:shadow-indigo-600/25' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                                    {t('plan_cta')}
                                </button>
                            </div>
                        )) : (
                            <div className="col-span-full text-center text-slate-500">
                                Loading plans...
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* --- PERFORMANCE SECTION --- */}
            <section id="performance" className="py-24 bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-sky-600/20 blur-[100px] rounded-full"></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-900/50 border border-sky-700 text-sky-400 text-xs font-bold uppercase tracking-wider mb-6">
                                <Zap className="w-3 h-3" /> {t('landing_perf_badge')}
                            </div>
                            <h2 className="text-3xl md:text-5xl font-extrabold mb-6">{t('landing_perf_title')}</h2>
                            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                                {t('landing_perf_desc')}
                            </p>

                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <div className="text-4xl font-extrabold text-sky-400 mb-1">10k+</div>
                                    <div className="text-sm font-medium text-slate-500 uppercase">{t('landing_stat_elements')}</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-extrabold text-emerald-400 mb-1">60fps</div>
                                    <div className="text-sm font-medium text-slate-500 uppercase">{t('landing_stat_scroll')}</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-extrabold text-indigo-400 mb-1">0.5s</div>
                                    <div className="text-sm font-medium text-slate-500 uppercase">{t('landing_stat_search')}</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-extrabold text-white mb-1">100%</div>
                                    <div className="text-sm font-medium text-slate-500 uppercase">{t('landing_stat_uptime')}</div>
                                </div>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-2xl">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between text-sm mb-2">
                                        <span className="text-slate-400">{t('landing_graph_engine')}</span>
                                        <span className="text-emerald-400 font-bold">{t('landing_graph_active')}</span>
                                    </div>
                                    <div className="w-full h-32 bg-slate-900 rounded-xl relative overflow-hidden">
                                        {/* Fake Graph */}
                                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-sky-500/20 to-transparent"></div>
                                        <svg className="absolute bottom-0 left-0 right-0 w-full h-full" preserveAspectRatio="none">
                                            <path d="M0,100 Q50,50 100,80 T200,40 T300,90 T400,20 T500,60 V120 H0 Z" fill="none" stroke="#0ea5e9" strokeWidth="2" />
                                        </svg>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-sky-500 w-[95%]"></div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 text-right">{t('landing_graph_load')}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- SECURITY --- */}
            <section className="py-24 bg-slate-950">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl text-sky-600">
                        <Shield className="w-8 h-8" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">{t('landing_sec_title')}</h2>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
                        {t('landing_sec_desc')}
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        {[
                            t('landing_sec_1'),
                            t('landing_sec_2'),
                            t('landing_sec_3'),
                            t('landing_sec_4'),
                            t('landing_sec_5')
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-full border border-slate-800 shadow-sm text-sm font-bold text-slate-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {item}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- HOW IT WORKS --- */}
            <section id="how-it-works" className="py-24 bg-slate-900 border-t border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-white mb-4">{t('landing_steps_title')}</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12 text-center relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden md:block absolute top-8 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-transparent via-slate-700 to-transparent z-0"></div>

                        {[
                            { step: "01", title: t('landing_step_1_title'), desc: t('landing_step_1_desc') },
                            { step: "02", title: t('landing_step_2_title'), desc: t('landing_step_2_desc') },
                            { step: "03", title: t('landing_step_3_title'), desc: t('landing_step_3_desc') }
                        ].map((item, idx) => (
                            <div key={idx} className="relative z-10 group">
                                <div className="w-16 h-16 mx-auto bg-slate-900 border-2 border-slate-700 rounded-2xl flex items-center justify-center text-xl font-bold text-slate-400 group-hover:text-sky-600 group-hover:border-sky-500 transition-all duration-300 shadow-sm group-hover:shadow-lg group-hover:-translate-y-1 mb-6">
                                    {item.step}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                                <p className="text-slate-400 leading-relaxed px-4">
                                    {item.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- CTA SECTION --- */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-sky-600"></div>
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/10 rounded-full blur-[120px] translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-900/40 rounded-full blur-[120px] -translate-x-1/2 translate-y-1/2"></div>

                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
                        {t('landing_cta_title')}
                    </h2>
                    <p className="text-xl text-sky-100 mb-10 max-w-2xl mx-auto">
                        {t('landing_cta_desc')}
                    </p>
                    <button
                        onClick={onRegisterClick}
                        className="px-10 py-5 bg-white text-sky-600 rounded-2xl font-bold text-xl shadow-2xl hover:bg-sky-50 transition-all transform hover:-translate-y-1 hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
                    >
                        {t('landing_cta_btn')}
                        <ArrowRight className="w-6 h-6" />
                    </button>
                </div>
            </section>

            {/* --- FOOTER --- */}
            <footer className="bg-slate-950 border-t border-slate-800 pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-4 gap-12 mb-16">
                        <div className="col-span-1 md:col-span-2">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center">
                                    <Network className="text-white w-5 h-5" />
                                </div>
                                <span className="font-bold text-xl text-white">{t('app_title')}</span>
                            </div>
                            <p className="text-slate-400 max-w-sm mb-6">
                                {t('landing_footer_desc')}
                            </p>
                            <div className="flex gap-4">
                                <a href="#" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-colors">
                                    <Globe className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-colors">
                                    <Network className="w-5 h-5" />
                                </a>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-white mb-6">{t('landing_footer_product')}</h4>
                            <ul className="space-y-4 text-sm text-slate-400">
                                <li><a href="#features" className="hover:text-sky-600 transition-colors">{t('landing_features')}</a></li>
                                <li><a href="#pricing" className="hover:text-sky-600 transition-colors">{t('landing_pricing')}</a></li>
                                <li><a href="#performance" className="hover:text-sky-600 transition-colors">{t('landing_performance')}</a></li>
                                <li><a href="#how-it-works" className="hover:text-sky-600 transition-colors">{t('landing_how_it_works')}</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-white mb-6">{t('landing_footer_company')}</h4>
                            <ul className="space-y-4 text-sm text-slate-400">
                                <li><a href="#" className="hover:text-sky-600 transition-colors">{t('landing_footer_legal')}</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-slate-400">
                            {t('landing_footer_rights')}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            {t('landing_stat_uptime')}
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};
