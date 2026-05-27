import React from 'react';
import { Edit, Hexagon, Palette } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { POLYGON_PALETTE } from '../types';
import { MapContextMenu, MenuHeader, MenuItem, DangerDelete } from './map/MapContextPrimitives';

interface PolygonContextMenuProps {
    x: number;
    y: number;
    name: string;
    color: string;
    onChangeColor: (color: string) => void;
    onEdit: () => void;
    onDelete: () => void;
    onClose: () => void;
}

export const PolygonContextMenu: React.FC<PolygonContextMenuProps> = ({
    x, y, name, color, onChangeColor, onEdit, onDelete, onClose,
}) => {
    const { t } = useLanguage();

    return (
        <MapContextMenu x={x} y={y} onClose={onClose} width={240}>
            <MenuHeader
                icon={<Hexagon className="w-3.5 h-3.5" />}
                iconBgColor={color}
                name={name}
                typeLabel={t('polygon_area') || 'Área'}
            />

            {/* Color picker */}
            <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700/30">
                <div className="flex items-center gap-1.5 mb-2">
                    <Palette className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {t('color') || 'Cor'}
                    </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {POLYGON_PALETTE.map(c => (
                        <button
                            key={c}
                            onClick={(e) => { e.stopPropagation(); onChangeColor(c); }}
                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-white dark:border-slate-600'}`}
                            style={{ backgroundColor: c }}
                            aria-label={c}
                            title={c}
                        />
                    ))}
                </div>
            </div>

            <div className="py-1">
                <MenuItem
                    icon={<Edit className="w-3.5 h-3.5" />}
                    label={t('edit') || 'Editar'}
                    onClick={() => { onEdit(); onClose(); }}
                />
            </div>

            <DangerDelete
                itemName={name}
                label={t('delete') || 'Excluir'}
                onDelete={onDelete}
                onClose={onClose}
            />
        </MapContextMenu>
    );
};
