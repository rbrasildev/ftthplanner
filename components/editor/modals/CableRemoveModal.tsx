import React from 'react';
import { AlertTriangle, Link } from 'lucide-react';
import { Button } from '../../common/Button';
import { useLanguage } from '../../../LanguageContext';

interface CableRemoveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const CableRemoveModal: React.FC<CableRemoveModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0 border border-red-300 dark:border-red-500/30">
                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                            {t('title_remove_cable') || 'Remover Cabo'}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            {t('confirm_remove_cable_box')}
                        </p>
                    </div>
                </div>
                <div className="flex flex-row gap-3 mt-6">
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        className="flex-1 font-bold shadow-lg"
                        icon={<Link className="w-4 h-4 rotate-45" />}
                    >
                        {t('action_remove') || 'Remover'}
                    </Button>
                    <Button variant="secondary" onClick={onClose} className="flex-1 font-medium">
                        {t('cancel')}
                    </Button>
                </div>
            </div>
        </div>
    );
};
