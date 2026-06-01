import React from 'react';
import { Edit, Move, Settings, Building2, UtilityPole } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { MapContextMenu, MenuHeader, MenuItem, DangerDelete } from './map/MapContextPrimitives';
import { CTOIcon } from './icons/TelecomIcons';

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

const TYPE_META: Record<NodeContextMenuProps['type'], { icon: React.ElementType; iconBg: string; label: string }> = {
    CTO: { icon: CTOIcon, iconBg: 'bg-emerald-500', label: 'CTO' },
    POP: { icon: Building2, iconBg: 'bg-indigo-500', label: 'POP' },
    Pole: { icon: UtilityPole, iconBg: 'bg-amber-500', label: 'Poste' },
};

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({ x, y, onEdit, onProperties, onDelete, onMove, onClose, type, nodeName }) => {
    const { t } = useLanguage();
    const meta = TYPE_META[type];
    const TypeIcon = meta.icon;

    return (
        <MapContextMenu x={x} y={y} onClose={onClose}>
            <MenuHeader
                icon={<TypeIcon className="w-3.5 h-3.5" />}
                iconBg={meta.iconBg}
                name={nodeName}
                typeLabel={meta.label}
            />

            <div className="py-1">
                {type !== 'Pole' && (
                    <MenuItem
                        icon={<Edit className="w-3.5 h-3.5" />}
                        label={t('edit_node_short')}
                        onClick={() => { onEdit(); onClose(); }}
                    />
                )}

                {onProperties && (
                    <MenuItem
                        icon={<Settings className="w-3.5 h-3.5" />}
                        label={t('properties')}
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

            {onDelete && (
                <DangerDelete
                    itemName={nodeName}
                    label={t('delete_node_short')}
                    onDelete={onDelete}
                    onClose={onClose}
                />
            )}
        </MapContextMenu>
    );
};
