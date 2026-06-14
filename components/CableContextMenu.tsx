import React from 'react';
import { Edit, Unplug, Settings, Eye, EyeOff, MapPin, Cable, Activity, Network } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import type { CableOpticalStatus } from '../utils/switchCableStatus';
import { statusColor, statusLabel } from '../utils/opticalLink';
import { MapContextMenu, MenuHeader, MenuItem, DangerDelete } from './map/MapContextPrimitives';

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
    targetType?: "CTO" | "POP" | "Pole";
    cableName?: string;
    /** Fase 4: status óptico de switch links atravessando este cabo. */
    opticalStatus?: CableOpticalStatus;
}

export const CableContextMenu: React.FC<CableContextMenuProps> = ({
    x, y, onEdit, onProperties, onDelete, onConnect, onClose,
    showReserveLabel, onToggleReserve, onPositionReserve, targetType, cableName,
    opticalStatus,
}) => {
    const { t } = useLanguage();
    const opticalBadge = opticalStatus ? statusColor(opticalStatus.status) : null;

    return (
        <MapContextMenu x={x} y={y} onClose={onClose} width={opticalStatus ? 288 : 224}>
            <MenuHeader
                icon={<Cable className="w-3.5 h-3.5" />}
                iconBg="bg-emerald-500"
                name={cableName}
                typeLabel={t('cable')}
            />

            <div className="py-1">
                <MenuItem
                    icon={<Edit className="w-3.5 h-3.5" />}
                    label={t('edit')}
                    onClick={() => { onEdit(); onClose(); }}
                />

                <MenuItem
                    icon={<Settings className="w-3.5 h-3.5" />}
                    label={t('properties')}
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

                {onConnect && (
                    <MenuItem
                        icon={<Unplug className="w-3.5 h-3.5" />}
                        label={
                            targetType === 'POP' ? t('connect_to_pop')
                                : targetType === 'Pole' ? t('connect_to_pole')
                                    : t('connect_to_box')
                        }
                        iconColor="text-amber-500 dark:text-amber-400"
                        onClick={() => { onConnect(); onClose(); }}
                    />
                )}
            </div>

            {/* Switch Links Optical Status */}
            {opticalStatus && opticalBadge && (
                <div className="border-t border-slate-100 dark:border-slate-700/30 bg-[#f9fafb]/50 dark:bg-[#0f1117]/50">
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

            {onDelete && (
                <DangerDelete
                    itemName={cableName}
                    label={t('delete')}
                    onDelete={onDelete}
                    onClose={onClose}
                />
            )}
        </MapContextMenu>
    );
};
