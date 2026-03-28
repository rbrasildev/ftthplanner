import React from 'react';
import { X, Save, RotateCw, Trash2, Magnet, Flashlight, Ruler, ArrowRightLeft, Image as ImageIcon, ChevronDown, ChevronUp, Maximize, Minimize2, Box, Eraser, AlignCenter, Triangle, Keyboard, CircleHelp, StickyNote, QrCode } from 'lucide-react';
import { Button } from '../common/Button';
import { CTOData } from '../../types';

type ToolMode = 'rotate' | 'delete' | 'smartAlign' | 'vfl' | 'otdr' | 'fusion' | 'splitterDropdown';

interface CTOEditorToolbarProps {
    t: (key: string) => string;
    propertiesName: string;
    onNameChange: (name: string) => void;

    // Window controls
    isMaximized: boolean;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onToggleMaximize: () => void;
    onClose: () => void;
    onWindowDragStart: (e: React.MouseEvent) => void;

    // Tool modes
    isRotateMode: boolean;
    isDeleteMode: boolean;
    showSplitterDropdown: boolean;
    isFusionToolActive: boolean;
    isSmartAlignMode: boolean;
    isVflToolActive: boolean;
    isOtdrToolActive: boolean;
    isSnapping: boolean;
    onToggleSnapping: () => void;
    toggleToolMode: (mode: ToolMode) => void;

    // Creation
    onAddFusion: (e: React.MouseEvent) => void;
    onAddNote: (e: React.MouseEvent) => void;

    // Connections
    isAutoSpliceOpen: boolean;
    onOpenAutoSplice: () => void;
    onClearConnections: () => void;

    // Hotkeys
    showHotkeys: boolean;
    onToggleHotkeys: () => void;
    hotkeysRef: React.RefObject<HTMLDivElement>;

    // Export
    onExportPNG: () => void;
    exportingType: 'png' | 'pdf' | null;
    onOpenQRCode: () => void;
}

export const CTOEditorToolbar: React.FC<CTOEditorToolbarProps> = React.memo(({
    t, propertiesName, onNameChange,
    isMaximized, isCollapsed, onToggleCollapse, onToggleMaximize, onClose, onWindowDragStart,
    isRotateMode, isDeleteMode, showSplitterDropdown, isFusionToolActive, isSmartAlignMode,
    isVflToolActive, isOtdrToolActive, isSnapping, onToggleSnapping, toggleToolMode,
    onAddFusion, onAddNote,
    isAutoSpliceOpen, onOpenAutoSplice, onClearConnections,
    showHotkeys, onToggleHotkeys, hotkeysRef,
    onExportPNG, exportingType, onOpenQRCode
}) => {
    return (
        <div
            className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col shrink-0 z-50 cursor-move select-none"
            onMouseDown={onWindowDragStart}
        >
            {/* Line 1: Title and Main Actions */}
            <div className="h-14 flex items-center justify-between px-6">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <h2 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2 whitespace-nowrap truncate min-w-0">
                        <Box className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                        <input
                            type="text"
                            value={propertiesName}
                            onChange={(e) => onNameChange(e.target.value)}
                            className="bg-transparent border-0 border-b-2 border-transparent focus:border-emerald-500 dark:focus:border-emerald-400 px-1 py-0.5 outline-none transition-all w-full max-w-[400px] text-slate-900 dark:text-white font-bold placeholder:text-slate-400"
                            placeholder={t('name')}
                        />
                    </h2>
                </div>
                <div className="flex gap-1 pointer-events-auto items-center">
                    {!isMaximized && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onToggleCollapse}
                            title={isCollapsed ? t('expand') : t('collapse')}
                            className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                        >
                            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleMaximize}
                        title={isMaximized ? t('restore') : t('maximize')}
                        className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                        {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        title={t('cancel')}
                        className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:text-rose-500 dark:hover:text-rose-400"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Line 2: All Tools and Exports — hidden when collapsed */}
            <div style={{ display: isCollapsed ? 'none' : undefined }} className="h-12 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between px-4">
                <div className="flex gap-1.5 pointer-events-auto items-center">

                    {/* GROUP 1: EDIT MODES */}
                    <div className="flex items-center gap-1.5 pr-2 border-r border-slate-300 dark:border-slate-600">
                        <Button
                            variant={isRotateMode ? 'emerald' : 'outline'}
                            size="icon"
                            onClick={() => toggleToolMode('rotate')}
                            className="h-8 w-8"
                            title={t('rotate_mode')}
                        >
                            <RotateCw className={`w-3.5 h-3.5 ${isRotateMode ? 'animate-spin-slow' : ''}`} />
                        </Button>
                        <Button
                            variant={isDeleteMode ? 'destructive' : 'outline'}
                            size="icon"
                            onClick={() => toggleToolMode('delete')}
                            className="h-8 w-8"
                            title={t('delete_mode')}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>

                    {/* GROUP 2: CREATION */}
                    <div className="flex items-center gap-1.5 px-2 border-r border-slate-300 dark:border-slate-600">
                        <Button
                            variant={showSplitterDropdown ? 'emerald' : 'outline'}
                            size="icon"
                            onClick={() => toggleToolMode('splitterDropdown')}
                            className="h-8 w-8"
                            title={t('splitters')}
                        >
                            <Triangle className="w-3.5 h-3.5 -rotate-90" />
                        </Button>
                        <Button
                            variant={isFusionToolActive ? 'emerald' : 'outline'}
                            size="icon"
                            onClick={onAddFusion}
                            className={`h-8 w-8 ${isFusionToolActive ? 'ring-2 ring-emerald-400' : ''}`}
                            title={t('add_fusion')}
                        >
                            <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="6" stroke="currentColor" fill="none" />
                                <circle cx="6" cy="12" r="3" fill="currentColor" stroke="none" />
                                <circle cx="18" cy="12" r="3" fill="currentColor" stroke="none" />
                            </svg>
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onAddNote}
                            className="h-8 w-8"
                            title={t('add_note')}
                        >
                            <StickyNote className="w-3.5 h-3.5" />
                        </Button>
                    </div>

                    {/* GROUP 3: CONNECTIONS */}
                    <div className="flex items-center gap-1.5 px-2 border-r border-slate-300 dark:border-slate-600">
                        <Button
                            variant={isAutoSpliceOpen ? 'emerald' : 'outline'}
                            size="icon"
                            onClick={onOpenAutoSplice}
                            className="h-8 w-8"
                            title={t('auto_splice')}
                        >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant={isSmartAlignMode ? 'primary' : 'outline'}
                            size="icon"
                            onClick={() => toggleToolMode('smartAlign')}
                            className={`h-8 w-8 ${isSmartAlignMode ? 'bg-amber-500 border-amber-600 text-white hover:bg-amber-400' : ''}`}
                            title={t('smart_align')}
                        >
                            <AlignCenter className={`w-3.5 h-3.5 ${isSmartAlignMode ? 'fill-white animate-pulse' : ''}`} />
                        </Button>

                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onClearConnections}
                            className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title={t('reset_connections')}
                        >
                            <Eraser className="w-3.5 h-3.5" />
                        </Button>
                    </div>

                    {/* GROUP 4: ANALYSIS */}
                    <div className="flex items-center gap-1.5 px-2 border-r border-slate-300 dark:border-slate-600">
                        <Button
                            variant={isVflToolActive ? 'destructive' : 'outline'}
                            size="icon"
                            onClick={() => toggleToolMode('vfl')}
                            className={`h-8 w-8 ${isVflToolActive ? 'bg-red-600 border-red-700 text-white hover:bg-red-500' : ''}`}
                            title={t('tool_vfl')}
                        >
                            <Flashlight className="w-3.5 h-3.5 animate-pulse" />
                        </Button>
                        <Button
                            variant={isOtdrToolActive ? 'emerald' : 'outline'}
                            size="icon"
                            onClick={() => toggleToolMode('otdr')}
                            className={`h-8 w-8 ${isOtdrToolActive ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-500' : ''}`}
                            title={t('otdr_trace_tool')}
                        >
                            <Ruler className="w-3.5 h-3.5" />
                        </Button>
                    </div>

                    {/* GROUP 5: VIEW */}
                    <div className="flex items-center gap-1.5 pl-2">
                        <Button
                            variant={isSnapping ? 'emerald' : 'outline'}
                            size="icon"
                            onClick={onToggleSnapping}
                            className="h-8 w-8"
                            title={t('snap_grid')}
                        >
                            <Magnet className="w-3.5 h-3.5" />
                        </Button>
                    </div>

                    {/* GROUP 6: HELP / SHORTCUTS */}
                    <div ref={hotkeysRef} className="flex items-center gap-1.5 pl-2 relative">
                        <Button
                            variant={showHotkeys ? 'emerald' : 'outline'}
                            size="icon"
                            onClick={onToggleHotkeys}
                            className="h-8 w-8"
                            title={t('hotkeys_title')}
                        >
                            <Keyboard className="w-3.5 h-3.5" />
                        </Button>

                        {showHotkeys && (
                            <div className="absolute top-10 right-0 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[100] p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
                                    <CircleHelp className="w-4 h-4 text-emerald-500" />
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{t('hotkeys_title')}</span>
                                </div>
                                <div className="space-y-2.5">
                                    {[
                                        { key: 'S', label: t('hotkey_s') },
                                        { key: 'F', label: t('hotkey_f') },
                                        { key: 'A', label: t('hotkey_a') },
                                        { key: 'R', label: t('hotkey_r') },
                                        { key: 'D', label: t('hotkey_d') }
                                    ].map(item => (
                                        <div key={item.key} className="flex items-center gap-3">
                                            <kbd className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded shadow-sm">
                                                {item.key}
                                            </kbd>
                                            <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-4 text-[10px] text-slate-400 italic text-center">
                                    {t('hotkeys_hint')}
                                </p>
                            </div>
                        )}
                    </div>

                </div>

                <div className="flex gap-2 pointer-events-auto items-center">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onExportPNG}
                        disabled={!!exportingType}
                        className="font-bold text-[11px] h-7 px-2.5"
                    >
                        {exportingType === 'png' ? <span className="animate-spin w-3 h-3 border-2 border-slate-400 border-t-slate-800 rounded-full mr-1.5"></span> : <ImageIcon className="w-3.5 h-3.5 mr-1.5" />}
                        PNG
                    </Button>

                     <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

                     <Button
                         variant="secondary"
                         size="sm"
                         onClick={onOpenQRCode}
                         disabled={!!exportingType}
                         className="font-bold text-[11px] h-7 px-2.5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/20"
                         title={t('qr_maintenance')}
                     >
                         <QrCode className="w-3.5 h-3.5 mr-1.5" />
                         {t('qr_code')}
                     </Button>
                </div>
            </div>
        </div>
    );
});
