import React from 'react';
import { useLanguage } from '../../LanguageContext';
import { Coordinates } from '../../types';
import { Ruler, X, Check } from 'lucide-react';
import L from 'leaflet';

interface RulerToolbarProps {
    rulerPoints: Coordinates[];
    onClear: () => void;
    onFinish: () => void;
}

export const RulerToolbar: React.FC<RulerToolbarProps> = ({ rulerPoints, onClear, onFinish }) => {
    const { t } = useLanguage();

    if (rulerPoints.length === 0) return null;

    const totalDistance = rulerPoints.reduce((acc, curr, idx) => {
        if (idx === 0) return 0;
        return acc + L.latLng(rulerPoints[idx - 1]).distanceTo(L.latLng(curr));
    }, 0);

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[2000] flex gap-3">
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-3 border border-slate-200 dark:border-slate-700">
                <Ruler className="w-5 h-5 text-pink-500" />
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase leading-none">{t('ruler_total')}</span>
                    <span className="text-sm text-pink-600 dark:text-pink-400">
                        {totalDistance.toFixed(1)}m
                    </span>
                </div>
                <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <button
                    onClick={onClear}
                    className="text-slate-500 hover:text-red-500 transition-colors text-xs flex items-center gap-1"
                >
                    <X className="w-4 h-4" />
                    {t('ruler_clear')}
                </button>
            </div>
            <button
                onClick={onFinish}
                className="bg-slate-900 dark:bg-slate-700 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transition-all hover:bg-slate-800 dark:hover:bg-slate-600"
            >
                <Check className="w-4 h-4" />
                {t('finish')}
            </button>
        </div>
    );
};
