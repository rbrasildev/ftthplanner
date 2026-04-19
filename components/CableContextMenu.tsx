import React, { useEffect, useRef, useState } from 'react';
import { Edit, Trash2, Unplug, AlertTriangle, X, Check, Settings, Eye, EyeOff, MapPin, Cable, Activity, Network } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import type { CableOpticalStatus } from '../utils/switchCableStatus';
import { statusColor, statusLabel } from '../utils/opticalLink';

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
    /** Fase 4: status óptico de switch links atravessando este cabo. */
    opticalStatus?: CableOpticalStatus;
}

export const CableContextMenu: React.FC<CableContextMenuProps> = ({
    x, y, onEdit, onProperties, onDelete, onConnect, onClose,
    showReserveLabel, onToggleReserve, onPositionReserve, targetType, cableName,
    opticalStatus,
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

    const opticalBadge = opticalStatus ? statusColor(opticalStatus.status) : null;

    return (
        <div
            ref={menuRef}
            className={`fixed z-[99999] bg-white dark:bg-[#1a1d23] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700/40 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${opticalStatus ? 'w-72' : 'w-56'}`}
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

            {/* Switch Links Optical Status */}
            {opticalStatus && opticalBadge && (
                <div className="border-t border-slate-100 dark:border-slate-700/30 bg-slate-50/50 dark:bg-[#151820]/50">
                    <div className="px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className={`w-3.5 h-3.5 ${opticalBadge.text}`} />
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                Switch Links
                            </span>
                        </div>
                        <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${opticalBadge.bg} ${opticalBadge.text} ${opticalBadge.border}`}
                        >
                            <span className={`w-1 h-1 rounded-full ${opticalBadge.dot}`} />
                            {statusLabel(opticalStatus.status)}
                        </span>
                    </div>
                    <div className="px-2 pb-2 space-y-1 max-h-48 overflow-y-auto">
                        {opticalStatus.links.map(link => {
                            const lc = statusColor(link.result.status);
                            return (
                                <div
                                    key={link.portId}
                                    className={`rounded-md px-2 py-1.5 border ${lc.bg} ${lc.border}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <Network className={`w-3 h-3 shrink-0 ${lc.text}`} />
                                            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                                                {link.switchName}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                                {link.portLabel}
                                            </span>
                                        </div>
                                        <span className={`w-1.5 h-1.5 rounded-full ${lc.dot} shrink-0`} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-2 mt-0.5 text-[10px] font-mono">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">RX:</span>
                                            <span className={`font-bold ${lc.text}`}>
                                                {link.result.potenciaRx.toFixed(1)} dBm
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Margem:</span>
                                            <span className={`font-bold ${lc.text}`}>
                                                {link.result.margem >= 0 ? '+' : ''}{link.result.margem.toFixed(1)} dB
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {link.popName} · fibra {link.fiberIndex + 1}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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
