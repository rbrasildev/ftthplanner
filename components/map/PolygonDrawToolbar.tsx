import React from 'react';
import { useLanguage } from '../../LanguageContext';
import { POLYGON_PALETTE } from '../../types';
import { Hexagon, X, CheckCircle2 } from 'lucide-react';

interface PolygonDrawToolbarProps {
    pointCount: number;
    color: string;
    onColorChange: (color: string) => void;
    onFinish: () => void;
    onCancel: () => void;
}

export const PolygonDrawToolbar: React.FC<PolygonDrawToolbarProps> = ({
    pointCount, color, onColorChange, onFinish, onCancel,
}) => {
    const { t } = useLanguage();
    const canFinish = pointCount >= 3;

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[2000] flex gap-3 items-center">
            <div className="bg-white/95 dark:bg-[#22262e]/95 backdrop-blur px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-200 dark:border-slate-700">
                <Hexagon className="w-5 h-5" style={{ color }} />
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase leading-none tracking-wide">
                        {t('polygon_drawing') || 'Desenhando área'}
                    </span>
                    <span className="text-xs text-slate-700 dark:text-slate-200 font-semibold">
                        {pointCount} {pointCount === 1 ? (t('point') || 'ponto') : (t('points') || 'pontos')}
                        {!canFinish && ` · ${t('polygon_need_more') || 'mínimo 3'}`}
                    </span>
                </div>
                <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1" />
                <div className="flex items-center gap-1.5">
                    {POLYGON_PALETTE.map(c => (
                        <button
                            key={c}
                            onClick={() => onColorChange(c)}
                            className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-white dark:border-slate-600'}`}
                            style={{ backgroundColor: c }}
                            aria-label={c}
                            title={c}
                        />
                    ))}
                </div>
            </div>

            <button
                onClick={onFinish}
                disabled={!canFinish}
                className={`px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transition-all ${canFinish
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'}`}
            >
                <CheckCircle2 className="w-5 h-5" />
                {t('finish') || 'Finalizar'}
            </button>

            <button
                onClick={onCancel}
                className="bg-white/90 dark:bg-[#22262e]/90 backdrop-blur px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
                <X className="w-5 h-5" />
                {t('cancel') || 'Cancelar'}
            </button>
        </div>
    );
};
