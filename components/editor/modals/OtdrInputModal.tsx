import React from 'react';
import { Ruler } from 'lucide-react';
import { Button } from '../../common/Button';
import { CustomInput } from '../../common/CustomInput';
import { useLanguage } from '../../../LanguageContext';

interface OtdrInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    distance: string;
    onDistanceChange: (value: string) => void;
    onSubmit: () => void;
}

export const OtdrInputModal: React.FC<OtdrInputModalProps> = ({
    isOpen, onClose, distance, onDistanceChange, onSubmit,
}) => {
    const { t } = useLanguage();
    if (!isOpen) return null;

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
                        <Ruler className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('otdr_title')}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('otdr_trace_msg')}</p>
                    </div>
                </div>

                <div className="mb-4">
                    <CustomInput
                        label={t('otdr_distance_lbl')}
                        type="number"
                        value={distance}
                        onChange={(e) => onDistanceChange(e.target.value)}
                        placeholder="e.g. 1250"
                        autoFocus
                    />
                </div>

                <div className="flex gap-2">
                    <Button variant="secondary" onClick={onClose} className="flex-1">
                        {t('cancel')}
                    </Button>
                    <Button variant="emerald" onClick={onSubmit} className="flex-1 font-bold shadow-lg">
                        {t('otdr_locate')}
                    </Button>
                </div>
            </div>
        </div>
    );
};
