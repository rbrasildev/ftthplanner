import React, { useEffect, useRef, useState } from 'react';
import { Edit, Trash2, Unplug, AlertTriangle, X, Check, Settings, Eye, EyeOff, MapPin, Cable } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface CableContextMenuProps {
    x: number;
    y: number;
    onEdit: () => void;
    onProperties: () => void;
    onDelete?: () => void;
    onConnect?: () => void;
    onClose: () => void;
    showReserveLabel?: boolean;
    onToggleReserve?: () => void;
    onPositionReserve?: () => void;
    targetType?: "CTO" | "POP";
    cableName?: string;
}

export const CableContextMenu: React.FC<CableContextMenuProps> = ({
    x, y, onEdit, onProperties, onDelete, onConnect, onClose,
    showReserveLabel, onToggleReserve, onPositionReserve, targetType, cableName
}) => {
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
            <div className="px-3 py-2.5 flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700/30">
                <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <Cable className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{cableName || t('cable')}</div>
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{t('cable')}</div>
                </div>
            </div>

            {/* Actions */}
            <div className="py-1">
                <MenuItem
                    icon={<Edit className="w-3.5 h-3.5" />}
                    label={t('edit')}
                    iconColor="text-emerald-500 dark:text-emerald-400"
                    onClick={() => { onEdit(); onClose(); }}
                />

                <MenuItem
                    icon={<Settings className="w-3.5 h-3.5" />}
                    label={t('properties')}
                    iconColor="text-emerald-500 dark:text-emerald-400"
                    onClick={() => { onProperties(); onClose(); }}
                />

                {onToggleReserve && (
                    <MenuItem
                        icon={showReserveLabel ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        label={showReserveLabel ? t('hide_reserve_label') : t('toggle_reserve_label')}
                        iconColor="text-indigo-500 dark:text-indigo-400"
                        onClick={() => { onToggleReserve(); onClose(); }}
                    />
                )}

                {onPositionReserve && (
                    <MenuItem
                        icon={<MapPin className="w-3.5 h-3.5" />}
                        label={t('position_reserve_label')}
                        iconColor="text-teal-500 dark:text-teal-400"
                        onClick={() => { onPositionReserve(); onClose(); }}
                    />
                )}

                <MenuItem
                    icon={<Unplug className="w-3.5 h-3.5" />}
                    label={targetType === 'POP' ? t('connect_to_pop') : t('connect_to_box')}
                    iconColor="text-amber-500 dark:text-amber-400"
                    onClick={() => { if (onConnect) onConnect(); onClose(); }}
                />
            </div>

            {/* Danger Zone */}
            <div className="border-t border-slate-100 dark:border-slate-700/30">
                {showDeleteConfirm ? (
                    <div className="p-2 space-y-2 animate-in fade-in duration-150 bg-red-50 dark:bg-red-950/20">
                        <div className="flex items-center gap-2 px-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                                {t('confirm_delete')}
                            </span>
                        </div>
                        <div className="flex gap-1.5">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                                className="flex-1 py-1.5 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-600/40 hover:bg-slate-50 dark:hover:bg-slate-600/30 text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                            >
                                <X className="w-3 h-3" />
                                {t('cancel')}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(); onClose(); }}
                                className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
                            >
                                <Check className="w-3 h-3" />
                                {t('confirm')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <MenuItem
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        label={t('delete')}
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
