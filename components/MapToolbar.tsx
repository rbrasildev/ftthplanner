import React from 'react';
import { MousePointer2, Move, Box, Building2, UtilityPole, Cable, ChevronDown, Plus, FileUp, Activity, Unplug } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface MapToolbarProps {
    toolMode: 'view' | 'add_cto' | 'add_pop' | 'add_pole' | 'draw_cable' | 'connect_cable' | 'move_node' | 'pick_connection_target' | 'otdr' | 'edit_cable';
    setToolMode: (mode: any) => void;
    activeMenuId: string | null;
    setActiveMenuId: (id: string | null) => void;
    onImportKml: () => void;
    onConnectClick: () => void;
}

export const MapToolbar: React.FC<MapToolbarProps> = ({
    toolMode,
    setToolMode,
    activeMenuId,
    setActiveMenuId,
    onImportKml,
    onConnectClick
}) => {
    const { t } = useLanguage();
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (activeMenuId === 'pole_menu' && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenuId(null);
            }
        };

        if (activeMenuId === 'pole_menu') {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeMenuId, setActiveMenuId]);

    const ToolButton = ({ mode, icon: Icon, label, onClick }: { mode?: string, icon: any, label: string, onClick?: () => void }) => {
        const isActive = toolMode === mode;
        const handleClick = onClick || (() => setToolMode(mode));
        return (
            <button
                onClick={handleClick}
                className={`relative group p-2.5 rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-1 min-w-[60px]
                ${isActive
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent'
                    }`}
                title={label}
            >
                <Icon className={`w-5 h-5 ${isActive ? 'fill-current opacity-20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[9px] font-bold uppercase tracking-tight leading-none">{label}</span>
            </button>
        );
    };

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-800/60 z-[1000] flex items-center gap-1 animate-in fade-in slide-in-from-top-4 duration-300">

            {/* Group 1: Navigation */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-200 dark:border-slate-700/50">
                <ToolButton mode="view" icon={MousePointer2} label={t('sidebar_select')} />
            </div>

            {/* Group 2: Construction */}
            <div className="flex items-center gap-1 px-2 border-r border-slate-200 dark:border-slate-700/50">
                <ToolButton mode="add_cto" icon={Box} label={t('reg_caixa') || "Caixa"} />
                <ToolButton mode="add_pop" icon={Building2} label="POP" />

                {/* Pole Dropdown Trigger */}
                <div className="relative" ref={menuRef}>
                    <ToolButton
                        mode="add_pole"
                        icon={UtilityPole}
                        label={t('sidebar_pole')}
                        onClick={() => setActiveMenuId(activeMenuId === 'pole_menu' ? null : 'pole_menu')}
                    />

                    {/* Pole Menu Dropdown */}
                    {activeMenuId === 'pole_menu' && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 grid gap-1 animate-in fade-in zoom-in-95 duration-200">
                            <button
                                onClick={() => {
                                    setToolMode('add_pole');
                                    setActiveMenuId(null);
                                }}
                                className={`flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${toolMode === 'add_pole' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                            >
                                <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md"><Plus className="w-3.5 h-3.5" /></div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold">{t('sidebar_add_pole_desc')}</span>
                                    <span className="text-[9px] opacity-60">1-click</span>
                                </div>
                            </button>
                            <button
                                onClick={() => {
                                    onImportKml();
                                    setActiveMenuId(null);
                                }}
                                className="flex items-center gap-2 p-2 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                            >
                                <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md"><FileUp className="w-3.5 h-3.5" /></div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold">Importar KMZ</span>
                                    <span className="text-[9px] opacity-60">Google Earth</span>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Group 3: Cabling */}
            <div className="flex items-center gap-1 pl-2">
                <ToolButton mode="draw_cable" icon={Activity} label="Cabo" />
            </div>

        </div>
    );
};
