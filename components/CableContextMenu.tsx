import React, { useEffect, useRef, useState } from 'react';
import { Edit, Trash2, Unplug, AlertTriangle, X, Check, Settings, Eye, EyeOff, MapPin } from 'lucide-react';
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
}

export const CableContextMenu: React.FC<CableContextMenuProps> = ({
    x, y, onEdit, onProperties, onDelete, onConnect, onClose,
    showReserveLabel, onToggleReserve, onPositionReserve
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
            className="fixed z-[99999] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 min-w-[200px] py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{ top: y, left: x }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                    onClose();
                }}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 transition-colors group"
            >
                <div className="p-1.5 bg-sky-50 dark:bg-sky-900/30 rounded-md group-hover:bg-sky-100 dark:group-hover:bg-sky-900/50 transition-colors">
                    <Edit className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <span className="text-sm font-medium">{t('edit')}</span>
            </button>

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onProperties();
                    onClose();
                }}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 transition-colors group"
            >
                <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-md group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
                    <Settings className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-medium">{t('properties')}</span>
            </button>

            {onToggleReserve && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleReserve();
                        onClose();
                    }}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 transition-colors group"
                >
                    <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-md group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
                        {showReserveLabel ? <EyeOff className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> : <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <span className="text-sm font-medium">{showReserveLabel ? (t('hide_reserve_label')) : (t('toggle_reserve_label'))}</span>
                </button>
            )}

            {onPositionReserve && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onPositionReserve();
                        onClose();
                    }}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 transition-colors group"
                >
                    <div className="p-1.5 bg-teal-50 dark:bg-teal-900/30 rounded-md group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 transition-colors">
                        <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <span className="text-sm font-medium">{t('position_reserve_label')}</span>
                </button>
            )}

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (onConnect) onConnect();
                    onClose();
                }}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 transition-colors group"
            >
                <div className="p-1.5 bg-amber-50 dark:bg-amber-900/30 rounded-md group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 transition-colors">
                    <Unplug className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm font-medium">{t('connect_to_box')}</span>
            </button>

            {showDeleteConfirm ? (
                <div className="p-2 space-y-2 animate-in fade-in slide-in-from-top-2 bg-red-50 dark:bg-red-900/10 rounded-b-lg border-t border-red-100 dark:border-red-900/30">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 px-1">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                            {t('confirm_delete')}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(false);
                            }}
                            className="flex-1 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        >
                            <X className="w-3 h-3" />
                            {t('cancel')}
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onDelete) onDelete();
                                onClose();
                            }}
                            className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
                        >
                            <Check className="w-3 h-3" />
                            {t('confirm')}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(true);
                    }}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors group border-t border-slate-100 dark:border-slate-700/50"
                >
                    <div className="p-1.5 bg-red-50 dark:bg-red-900/30 rounded-md group-hover:bg-red-100 dark:group-hover:bg-red-900/50 transition-colors">
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-sm font-medium">{t('delete')}</span>
                </button>
            )}
        </div>
    );
};
