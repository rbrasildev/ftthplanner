import React from 'react';
import { MousePointer2, Box, Building2, UtilityPole, Waypoints, Ruler, UserPlus } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { hasPermission } from '../shared/permissions';

interface MapToolbarProps {
    toolMode: 'view' | 'add_cto' | 'add_pop' | 'add_pole' | 'add_customer' | 'draw_cable' | 'connect_cable' | 'move_node' | 'pick_connection_target' | 'otdr' | 'edit_cable' | 'ruler' | 'export_area';
    setToolMode: (mode: any) => void;
    activeMenuId: string | null;
    setActiveMenuId: (id: string | null) => void;
    onImportKml: () => void;
    onConnectClick: () => void;
    userRole?: string | null;
    userPermissions?: string[];
}

export const MapToolbar: React.FC<MapToolbarProps> = ({
    toolMode,
    setToolMode,
    activeMenuId,
    setActiveMenuId,
    onImportKml,
    onConnectClick,
    userRole,
    userPermissions = []
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

    const can = (perm: string) => hasPermission(userPermissions, perm as any) || userRole === 'OWNER';

    const ToolButton = ({ mode, icon: Icon, label, onClick }: { mode?: string, icon: any, label: string, onClick?: () => void }) => {
        const isActive = toolMode === mode;
        const handleClick = onClick || (() => setToolMode(mode));
        return (
            <button
                onClick={handleClick}
                className={`relative group p-2.5 rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-1 min-w-[60px]
                ${isActive
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent'
                    }`}
                title={label}
            >
                <Icon className={`w-5 h-5 ${isActive ? 'fill-current opacity-20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[9px] font-bold uppercase tracking-tight leading-none">{label}</span>
            </button>
        );
    };

    const showCto = can('map:add_cto');
    const showPop = can('map:add_pop');
    const showCustomer = can('map:add_customer');
    const showPole = can('map:add_pole');
    const showCable = can('map:add_cable');
    const showConstructionGroup = showCto || showPop || showCustomer || showPole;

    return (
        <div className="bg-white/90 dark:bg-[#1a1d23]/90 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-700/30 flex items-center gap-1 animate-in fade-in slide-in-from-top-4 duration-300">

            {/* Group 1: Navigation */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-200 dark:border-slate-700/50">
                <ToolButton mode="view" icon={MousePointer2} label={t('sidebar_select')} />
            </div>

            {/* Group 2: Construction — permission-based per button */}
            {showConstructionGroup && (
                <div className="flex items-center gap-1 px-2 border-r border-slate-200 dark:border-slate-700/50">
                    {showCto && <ToolButton mode="add_cto" icon={Box} label={t('reg_caixa') || "Caixa"} />}
                    {showPop && <ToolButton mode="add_pop" icon={Building2} label="POP" />}
                    {showCustomer && <ToolButton mode="add_customer" icon={UserPlus} label={t('sidebar_customer') || "Cliente"} />}
                    {showPole && (
                        <ToolButton
                            mode="add_pole"
                            icon={UtilityPole}
                            label={t('sidebar_pole') || "Poste"}
                        />
                    )}
                </div>
            )}

            {/* Group 3: Cabling & Measurement */}
            <div className="flex items-center gap-1 pl-2">
                {showCable && <ToolButton mode="draw_cable" icon={Waypoints} label="Cabo" />}
                <ToolButton mode="ruler" icon={Ruler} label={t('mode_ruler') || "Régua"} />
            </div>

        </div>
    );
};
