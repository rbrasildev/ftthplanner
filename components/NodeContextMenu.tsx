import React, { useEffect, useRef, useState } from 'react';
import { Edit, Trash2, Move, Settings, AlertTriangle, X, Check, Box, Building2, UtilityPole } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface NodeContextMenuProps {
    x: number;
    y: number;
    onEdit: () => void;
    onProperties?: () => void;
    onDelete?: () => void;
    onMove?: () => void;
    onConnect?: () => void;
    onClose: () => void;
    type: 'CTO' | 'POP' | 'Pole';
    nodeName?: string;
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({ x, y, onEdit, onProperties, onDelete, onMove, onConnect, onClose, type, nodeName }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const TypeIcon = type === 'CTO' ? Box : type === 'POP' ? Building2 : UtilityPole;
    const accentColor = type === 'CTO' ? 'emerald' : type === 'POP' ? 'indigo' : 'amber';

    const accentMap: Record<string, { bg: string; text: string; border: string }> = {
        emerald: { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30' },
        indigo: { bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/30' },
        amber: { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30' },
    };

    const accent = accentMap[accentColor];

    return (
        <div
            ref={menuRef}
            className="fixed z-[99999] w-56 bg-white dark:bg-[#1a1d23] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700/40 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{
                top: y > window.innerHeight / 2 ? 'auto' : y,
                bottom: y > window.innerHeight / 2 ? window.innerHeight - y : 'auto',
                left: x > window.innerWidth / 2 ? 'auto' : x,
                right: x > window.innerWidth / 2 ? window.innerWidth - x : 'auto'
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Header */}
            <div className={`px-3 py-2.5 flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700/30`}>
                <div className={`w-7 h-7 ${accent.bg} rounded-lg flex items-center justify-center`}>
                    <TypeIcon className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{nodeName || type}</div>
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{type}</div>
                </div>
            </div>

            {/* Actions */}
            <div className="py-1">
                {type !== 'Pole' && (
                    <MenuItem
                        icon={<Edit className="w-3.5 h-3.5" />}
                        label={t('edit_node_short')}
                        iconColor="text-emerald-500 dark:text-emerald-400"
                        onClick={() => { onEdit(); onClose(); }}
                    />
                )}

                {onProperties && (
                    <MenuItem
                        icon={<Settings className="w-3.5 h-3.5" />}
                        label={t('properties')}
                        iconColor="text-emerald-500 dark:text-emerald-400"
                        onClick={() => { onProperties(); onClose(); }}
                    />
                )}

                {onMove && (
                    <MenuItem
                        icon={<Move className="w-3.5 h-3.5" />}
                        label={t('move_node_short')}
                        iconColor="text-indigo-500 dark:text-indigo-400"
                        onClick={() => { onMove(); onClose(); }}
                    />
                )}
            </div>

            {/* Danger Zone */}
            <div className="border-t border-slate-100 dark:border-slate-700/30">
                {showDeleteConfirm ? (
                    <div className="p-2 space-y-2 animate-in fade-in duration-150 bg-red-50 dark:bg-red-950/20">
                        <div className="flex items-center gap-2 px-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                                {t('confirm_delete') || "Tem certeza?"}
                            </span>
                        </div>
                        <div className="flex gap-1.5">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                                className="flex-1 py-1.5 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-600/40 hover:bg-slate-50 dark:hover:bg-slate-600/30 text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                            >
                                <X className="w-3 h-3" />
                                {t('cancel') || "Nao"}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(); onClose(); }}
                                className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
                            >
                                <Check className="w-3 h-3" />
                                {t('confirm') || "Sim"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <MenuItem
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        label={t('delete_node_short')}
                        iconColor="text-red-500 dark:text-red-400"
                        danger
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                    />
                )}
            </div>
        </div>
    );
};

const MenuItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    iconColor: string;
    danger?: boolean;
    onClick: (e: React.MouseEvent) => void;
}> = ({ icon, label, iconColor, danger, onClick }) => (
    <button
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors text-[13px] font-medium
            ${danger
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}
    >
        <span className={iconColor}>{icon}</span>
        <span>{label}</span>
    </button>
);
