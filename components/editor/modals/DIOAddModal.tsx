import React, { useState, useEffect, useMemo } from 'react';
import { X, Server, Minus, Plus } from 'lucide-react';
import { Button } from '../../common/Button';
import { useLanguage } from '../../../LanguageContext';

interface DIOAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (ports: number, name?: string) => void;
    /** Suggested name shown as the input placeholder default (e.g. "DIO 3"). */
    suggestedName?: string;
}

const PRESETS = [8, 12, 16, 24, 48, 96];
const MIN_PORTS = 1;
const MAX_PORTS = 288;

export const DIOAddModal: React.FC<DIOAddModalProps> = ({ isOpen, onClose, onConfirm, suggestedName }) => {
    const { t } = useLanguage();
    const [value, setValue] = useState<string>('12');
    const [name, setName] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setValue('12');
            setName('');
        }
    }, [isOpen]);

    const parsed = parseInt(value, 10);
    const isValid = !isNaN(parsed) && parsed >= MIN_PORTS && parsed <= MAX_PORTS;

    // Visual preview reflects the actual node geometry: 36px wide, 12px per port row.
    // Cap rendered ports for the preview to keep the modal compact.
    const previewPortCount = useMemo(() => Math.min(isValid ? parsed : 12, 24), [parsed, isValid]);

    if (!isOpen) return null;

    const submit = () => {
        if (!isValid) return;
        const trimmed = name.trim();
        onConfirm(parsed, trimmed || undefined);
        onClose();
    };

    const nudge = (delta: number) => {
        const base = isValid ? parsed : 12;
        const next = Math.max(MIN_PORTS, Math.min(MAX_PORTS, base + delta));
        setValue(String(next));
    };

    return (
        <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto">
            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 w-[420px] max-w-[92vw] overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between px-5 py-4 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-900/20 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            <Server className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                                {t('add_dio')}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {t('dio_modal_subtitle')}
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Body */}
                <div className="p-5 flex gap-5">
                    {/* Left: form */}
                    <div className="flex-1 min-w-0 flex flex-col gap-4">
                        {/* Name */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                                {t('dio_name_label')}
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') submit();
                                    else if (e.key === 'Escape') onClose();
                                }}
                                placeholder={suggestedName || t('dio_name_placeholder')}
                                maxLength={32}
                                className="w-full bg-slate-50 dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors"
                            />
                        </div>

                        {/* Port count with stepper */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                                {t('dio_port_count')}
                            </label>
                            <div className="flex items-stretch gap-1.5">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => nudge(-1)}
                                    disabled={isValid && parsed <= MIN_PORTS}
                                    className="h-10 w-10 shrink-0"
                                    title="-1"
                                >
                                    <Minus className="w-4 h-4" />
                                </Button>
                                <input
                                    type="number"
                                    min={MIN_PORTS}
                                    max={MAX_PORTS}
                                    value={value}
                                    autoFocus
                                    onChange={(e) => setValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') submit();
                                        else if (e.key === 'Escape') onClose();
                                    }}
                                    className={`flex-1 min-w-0 text-center font-mono text-lg font-bold bg-slate-50 dark:bg-[#22262e] border rounded-lg px-2 py-2 text-slate-900 dark:text-white focus:outline-none transition-colors
                                        ${isValid
                                            ? 'border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-400'
                                            : 'border-rose-400 dark:border-rose-500 focus:border-rose-500'}
                                    `}
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => nudge(1)}
                                    disabled={isValid && parsed >= MAX_PORTS}
                                    className="h-10 w-10 shrink-0"
                                    title="+1"
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                            <p className={`text-[10.5px] mt-1.5 leading-snug ${isValid ? 'text-slate-500 dark:text-slate-400' : 'text-rose-500 dark:text-rose-400 font-medium'}`}>
                                {isValid
                                    ? t('dio_port_count_hint')
                                    : t('dio_port_count_invalid', { min: MIN_PORTS, max: MAX_PORTS })}
                            </p>
                        </div>

                        {/* Presets */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                                {t('dio_presets_label')}
                            </label>
                            <div className="grid grid-cols-6 gap-1">
                                {PRESETS.map(p => {
                                    const active = parsed === p;
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setValue(String(p))}
                                            className={`py-1.5 text-[11px] font-bold rounded-md transition-all border ${
                                                active
                                                    ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm scale-[1.03]'
                                                    : 'bg-slate-50 dark:bg-[#22262e] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right: live preview */}
                    <div className="w-[110px] shrink-0 flex flex-col items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 self-start">
                            {t('dio_preview_label')}
                        </span>
                        <div className="flex-1 w-full bg-slate-100 dark:bg-[#0f1115] border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center p-2 gap-1.5">
                            <DIOPreview ports={previewPortCount} />
                            <div className="text-center leading-tight">
                                <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[90px]">
                                    {(name.trim() || suggestedName || 'DIO').slice(0, 14)}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                    {isValid ? parsed : '—'}p
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 pb-5 pt-1">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="flex-1 text-slate-500"
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        variant="emerald"
                        onClick={submit}
                        disabled={!isValid}
                        className="flex-1 font-bold"
                    >
                        {t('add')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

// Compact static preview of the DIO body. Mirrors DIONode geometry (36w × portsRow=12)
// but scaled down so it always fits the side panel.
const DIOPreview: React.FC<{ ports: number }> = ({ ports }) => {
    const ROW = 4;
    const PAD = 4;
    const W = 26;
    const H = PAD * 2 + ports * ROW;
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
            {/* Body */}
            <rect
                x={0} y={0} width={W} height={H} rx={2}
                className="fill-slate-700 dark:fill-slate-800 stroke-slate-900 dark:stroke-black"
                strokeWidth={0.5}
            />
            {/* Top/bottom screw dots */}
            {[0, W - 1].map((cx, i) => (
                <React.Fragment key={i}>
                    <circle cx={cx === 0 ? 2 : W - 2} cy={2} r={0.5} className="fill-slate-500/80" />
                    <circle cx={cx === 0 ? 2 : W - 2} cy={H - 2} r={0.5} className="fill-slate-500/80" />
                </React.Fragment>
            ))}
            {/* Port rows */}
            {Array.from({ length: ports }).map((_, i) => {
                const cy = PAD + i * ROW + ROW / 2;
                return (
                    <g key={i}>
                        <circle cx={3} cy={cy} r={1.2} className="fill-white dark:fill-slate-200 stroke-slate-900" strokeWidth={0.3} />
                        <line x1={5} y1={cy} x2={W - 5} y2={cy} className="stroke-slate-500/60" strokeWidth={0.5} />
                        <rect x={W - 4.5} y={cy - 1.2} width={2.4} height={2.4} rx={0.3} className="fill-slate-300 dark:fill-slate-400 stroke-slate-900" strokeWidth={0.3} />
                    </g>
                );
            })}
        </svg>
    );
};
