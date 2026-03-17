import React from 'react';
import { useLanguage } from '../../LanguageContext';
import { Coordinates } from '../../types';

interface MapModeTooltipProps {
    toolMode: string;
    drawingPath: Coordinates[];
}

export const MapModeTooltip: React.FC<MapModeTooltipProps> = ({ toolMode, drawingPath }) => {
    const { t } = useLanguage();

    return (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-800/90 backdrop-blur text-slate-700 dark:text-white px-4 py-2 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 text-xs font-medium z-[500] pointer-events-none">
            {toolMode === 'view' && t('tooltip_view')}
            {toolMode === 'move_node' && t('tooltip_move')}
            {toolMode === 'add_cto' && t('tooltip_add_cto')}
            {toolMode === 'add_pop' && t('tooltip_add_pop')}
            {toolMode === 'add_pole' && t('tooltip_add_pole')}
            {toolMode === 'ruler' && t('tooltip_ruler')}
            {toolMode === 'draw_cable' && (drawingPath.length === 0 ? t('tooltip_draw_cable_start') : t('tooltip_draw_cable'))}
            {toolMode === 'pick_connection_target' && t('toast_select_next_box')}
            {toolMode === 'position_reserve' && t('tooltip_position_reserve')}
        </div>
    );
};
