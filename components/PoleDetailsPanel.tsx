
import React, { useState, useEffect, useRef } from 'react';
import { PoleData, PoleStatus, POLE_STATUS_COLORS } from '../types';
import { UtilityPole, Settings2, Trash2, Activity, MapPin, Box, Type, X, AlertTriangle, ChevronDown } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { getPoles, PoleCatalogItem } from '../services/catalogService';

// Use definitions from types.ts
// const POLE_STATUS_COLORS is imported now.

interface PoleDetailsPanelProps {
    pole: PoleData;
    onRename: (id: string, newName: string) => void;
    onUpdateStatus: (id: string, status: PoleStatus) => void;
    onUpdate: (id: string, updates: Partial<PoleData>) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

export const PoleDetailsPanel: React.FC<PoleDetailsPanelProps> = ({
    pole,
    onRename,
    onUpdateStatus,
    onUpdate,
    onDelete,
    onClose
}) => {
    const { t } = useLanguage();
    const [name, setName] = useState(pole.name);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [availablePoles, setAvailablePoles] = useState<PoleCatalogItem[]>([]);

    useEffect(() => {
        setName(pole.name);
    }, [pole.id, pole.name]);

    useEffect(() => {
        getPoles().then(setAvailablePoles).catch(console.error);
    }, []);

    const handleNameBlur = () => {
        if (name !== pole.name) {
            onRename(pole.id, name);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onDelete(pole.id);
    };

    const handleCancelDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setShowDeleteConfirm(false);
    };

    // Draggable Logic
    const panelRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef({
        isDragging: false,
        startX: 0,
        startY: 0,
        initialLeft: 0,
        initialTop: 0
    });

    // Center initial position
    useEffect(() => {
        if (panelRef.current) {
            const width = 400;
            const height = panelRef.current.offsetHeight || 500;
            const initialX = (window.innerWidth - width) / 2;
            const initialY = Math.max(50, (window.innerHeight - height) / 2);
            panelRef.current.style.left = `${initialX}px`;
            panelRef.current.style.top = `${initialY}px`;
        }
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragRef.current.isDragging || !panelRef.current) return;

            e.preventDefault();
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;

            panelRef.current.style.left = `${dragRef.current.initialLeft + dx}px`;
            panelRef.current.style.top = `${dragRef.current.initialTop + dy}px`;
        };

        const handleMouseUp = () => {
            dragRef.current.isDragging = false;
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!panelRef.current) return;
        dragRef.current.isDragging = true;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;

        const rect = panelRef.current.getBoundingClientRect();
        dragRef.current.initialLeft = rect.left;
        dragRef.current.initialTop = rect.top;

        document.body.style.userSelect = 'none';
    };

    return (
        <div
            ref={panelRef}
            className="fixed z-[2000] w-[400px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden h-auto max-h-[80vh]"
            style={{ willChange: 'top, left', transition: 'none' }}
        >

            {/* Header */}
            <div
                onMouseDown={handleMouseDown}
                className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-slate-800 shrink-0 cursor-move select-none"
            >
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <UtilityPole className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                    {t('edit_pole')}
                </h2>
                <div className="flex items-center gap-3">
                    <div
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: POLE_STATUS_COLORS[pole.status || 'PLANNED'] }}
                        title={pole.status}
                    />
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 flex-1 overflow-y-auto">

                {/* Name Input */}
                <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                        <Type className="w-3 h-3" /> {t('name')}
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={handleNameBlur}
                        onKeyDown={(e) => e.key === 'Enter' && handleNameBlur()}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        placeholder={t('name')}
                        autoFocus
                    />
                </div>

                {/* Pole Type Select */}
                <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                        <UtilityPole className="w-3 h-3" /> {t('pole_type')}
                    </label>
                    <div className="relative">
                        <select
                            value={pole.catalogId || ''}
                            onChange={(e) => {
                                const selectedId = e.target.value;
                                const poleItem = availablePoles.find(p => p.id === selectedId);
                                if (poleItem) {
                                    onUpdate(pole.id, {
                                        catalogId: selectedId,
                                        type: poleItem.name, // Update plain text type as well for backward compat
                                    });
                                } else if (selectedId === '') {
                                    // Optional: handle clearing type
                                    onUpdate(pole.id, { catalogId: undefined });
                                }
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none"
                        >
                            <option value="">{t('select_pole_type')}</option>
                            {availablePoles.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.name} ({item.type} {item.height}m)
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>

                {/* Status Select */}
                <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                        <Activity className="w-3 h-3" /> {t('status')}
                    </label>
                    <select
                        value={pole.status || 'PLANNED'}
                        onChange={(e) => onUpdateStatus(pole.id, e.target.value as PoleStatus)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                    >
                        <option value="PLANNED">{t('status_PLANNED')}</option>
                        <option value="ANALYSING">{t('status_ANALYSING')}</option>
                        <option value="LICENSED">{t('status_LICENSED')}</option>
                    </select>
                </div>

                {/* Info & Location */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 space-y-2">
                    <div className="pt-0 flex items-start gap-2">
                        <MapPin className="w-3 h-3 text-slate-400 mt-0.5" />
                        <span className="text-[10px] text-slate-500 font-mono leading-tight">
                            {pole.coordinates.lat.toFixed(5)}, <br /> {pole.coordinates.lng.toFixed(5)}
                        </span>
                    </div>
                </div>

                {/* Delete Button */}
                <div className="pt-2">
                    {showDeleteConfirm ? (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <p className="text-xs font-medium leading-tight">
                                    {t('confirm_delete_pole_msg').replace('{name}', pole.name)}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancelDelete}
                                    className="flex-1 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-xs font-medium transition"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-bold transition shadow-lg shadow-red-900/20"
                                >
                                    {t('confirm_delete')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleDeleteClick}
                            className="w-full py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center justify-center gap-2 transition text-sm font-medium cursor-pointer"
                        >
                            <Trash2 className="w-4 h-4" />
                            {t('delete_pole_btn')}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};
