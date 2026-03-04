import React from 'react';
import { MousePointer2, Move, Box, Building2, UtilityPole, Cable, ChevronDown, Plus, FileUp, FileDown, Waypoints, Unplug, Ruler, UserPlus } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface MapToolbarProps {
    toolMode: 'view' | 'add_cto' | 'add_pop' | 'add_pole' | 'add_customer' | 'draw_cable' | 'connect_cable' | 'move_node' | 'pick_connection_target' | 'otdr' | 'edit_cable' | 'ruler';
    setToolMode: (mode: any) => void;
    activeMenuId: string | null;
    setActiveMenuId: (id: string | null) => void;
    onImportKml: () => void;
    onExportKmz?: () => void;
    isExporting?: boolean;
    onConnectClick: () => void;
    userRole?: string | null;
}

export const MapToolbar: React.FC<MapToolbarProps> = ({
    toolMode,
    setToolMode,
    activeMenuId,
    setActiveMenuId,
    onImportKml,
    onExportKmz,
    isExporting,
    onConnectClick,
    userRole
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
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white border border-transparent'
                    }`}
                title={label}
            >
                <Icon className={`w-5 h-5 ${isActive ? 'fill-current opacity-20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[9px] font-bold uppercase tracking-tight leading-none">{label}</span>
            </button>
        );
    };

    return (
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-zinc-200/60 dark:border-zinc-800/60 flex items-center gap-1 animate-in fade-in slide-in-from-top-4 duration-300">

            {/* Group 1: Navigation */}
            <div className="flex items-center gap-1 pr-2 border-r border-zinc-200 dark:border-zinc-700/50">
                <ToolButton mode="view" icon={MousePointer2} label={t('sidebar_select')} />
            </div>

            {/* Group 2: Construction - Hide for MEMBER */}
            {(userRole !== 'MEMBER') && (
                <div className="flex items-center gap-1 px-2 border-r border-zinc-200 dark:border-zinc-700/50">
                    <ToolButton mode="add_cto" icon={Box} label={t('reg_caixa') || "Caixa"} />
                    <ToolButton mode="add_pop" icon={Building2} label="POP" />
                    <ToolButton mode="add_customer" icon={UserPlus} label={t('sidebar_customer') || "Cliente"} />

                    {/* Pole Button - No More Dropdown */}
                    <ToolButton
                        mode="add_pole"
                        icon={UtilityPole}
                        label={t('sidebar_pole') || "Poste"}
                    />
                </div>
            )}

            {/* Group 3: Cabling & Measurement */}
            <div className="flex items-center gap-1 pl-2">
                {userRole !== 'MEMBER' && <ToolButton mode="draw_cable" icon={Waypoints} label="Cabo" />}
                <ToolButton mode="ruler" icon={Ruler} label={t('mode_ruler') || "Régua"} />
            </div>

            {/* Group 4: Project Actions */}
            {(userRole !== 'MEMBER') && (
                <div className="flex items-center gap-1 pl-2 ml-1 border-l border-zinc-200 dark:border-zinc-700/50">
                    <button
                        onClick={onExportKmz}
                        disabled={isExporting}
                        className={`relative group p-2.5 rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-1 min-w-[60px] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white border border-transparent ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={t('export_kmz_tooltip') || "Exportar para Google Earth"}
                    >
                        <FileDown className={`w-5 h-5 ${isExporting ? 'animate-bounce text-emerald-500' : ''}`} strokeWidth={2} />
                        <span className="text-[9px] font-bold uppercase tracking-tight leading-none">{t('export_kmz_button') || "Exportar"}</span>
                    </button>
                </div>
            )}

        </div>
    );
};
