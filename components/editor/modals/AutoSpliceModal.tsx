import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '../../common/Button';
import { CustomSelect } from '../../common/CustomSelect';
import { useLanguage } from '../../../LanguageContext';
import { CableData } from '../../../types';

interface AutoSpliceModalProps {
    isOpen: boolean;
    onClose: () => void;
    cables: CableData[];
    sourceId: string;
    targetId: string;
    onSourceChange: (id: string) => void;
    onTargetChange: (id: string) => void;
    onConfirm: () => void;
}

export const AutoSpliceModal: React.FC<AutoSpliceModalProps> = ({
    isOpen, onClose, cables, sourceId, targetId, onSourceChange, onTargetChange, onConfirm,
}) => {
    const { t } = useLanguage();
    if (!isOpen) return null;

    const cableOptions = [
        { value: '', label: t('select_cable') },
        ...cables.map(c => ({ value: c.id, label: `${c.name} (${c.fiberCount} FO)` })),
    ];

    return (
        <div
            className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                        <ArrowRightLeft className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('auto_splice')}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('auto_splice_help')}</p>
                    </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-normal">
                    {t('auto_splice_desc')}
                </p>

                <div className="space-y-4 mb-6">
                    <CustomSelect
                        label={t('source_cable')}
                        value={sourceId}
                        onChange={onSourceChange}
                        showSearch={false}
                        options={cableOptions}
                    />
                    <CustomSelect
                        label={t('target_cable')}
                        value={targetId}
                        onChange={onTargetChange}
                        showSearch={false}
                        options={cableOptions}
                    />
                </div>

                <div className="flex gap-2">
                    <Button variant="secondary" onClick={onClose} className="flex-1">
                        {t('cancel')}
                    </Button>
                    <Button
                        variant="emerald"
                        onClick={onConfirm}
                        disabled={!sourceId || !targetId || sourceId === targetId}
                        className="flex-1 font-bold shadow-lg"
                    >
                        {t('perform_splice')}
                    </Button>
                </div>
            </div>
        </div>
    );
};
