import React, { useEffect, useRef, useState } from 'react';
import { Edit, Trash2, Move, Settings, AlertTriangle, X, Check } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface NodeContextMenuProps {
    x: number;
    y: number;
    onEdit: () => void;
    onProperties?: () => void;
    onDelete?: () => void;
    onMove?: () => void;
    onClose: () => void;
    type: 'CTO' | 'POP' | 'Pole';
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({ x, y, onEdit, onProperties, onDelete, onMove, onClose, type }) => {
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

    const getLabel = (action: string) => {
        const typeLabel = type === 'CTO' ? 'CTO' : type === 'POP' ? 'POP' : 'Poste';
        return `${action} ${typeLabel}`;
    };

    return (
        <div
            ref={menuRef}
            className="fixed z-[99999] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 min-w-[180px] py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
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
                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-md group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                    <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium">{getLabel('Editar')}</span>
            </button>

            {onProperties && (
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
                    <span className="text-sm font-medium">Propriedades</span>
                </button>
            )}

            {onMove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onMove();
                        onClose();
                    }}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 transition-colors group"
                >
                    <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-md group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
                        <Move className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="text-sm font-medium">{getLabel('Mover')}</span>
                </button>
            )}

            {showDeleteConfirm ? (
                <div className="p-2 space-y-2 animate-in fade-in slide-in-from-top-2 bg-red-50 dark:bg-red-900/10 rounded-b-lg border-t border-red-100 dark:border-red-900/30">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 px-1">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                            {t('confirm_delete') || "Tem certeza?"}
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
                            {t('cancel') || "Não"}
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
                            {t('confirm') || "Sim"}
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
                    <span className="text-sm font-medium">{getLabel('Excluir')}</span>
                </button>
            )}
        </div>
    );
};
