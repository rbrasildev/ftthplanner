import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../LanguageContext';

export const ConnectionStatus: React.FC = () => {
    const { t } = useLanguage();
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isBackendDown, setIsBackendDown] = useState(false);
    const [showRestored, setShowRestored] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            setShowRestored(true);
            setTimeout(() => setShowRestored(false), 3000);
        };
        const handleOffline = () => {
            setIsOffline(true);
            setIsBackendDown(false); // If browser is offline, prioritize that
        };

        const handleBackendError = () => {
            if (!navigator.onLine) return; // If offline, we already have a message
            setIsBackendDown(true);
        };

        // Reset backend error on any successful request
        const handleBackendSuccess = () => setIsBackendDown(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('ftth-connection-error', handleBackendError);
        window.addEventListener('ftth-connection-success', handleBackendSuccess);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('ftth-connection-error', handleBackendError);
            window.removeEventListener('ftth-connection-success', handleBackendSuccess);
        };
    }, []);

    const isDisconnected = isOffline || isBackendDown;

    return (
        <AnimatePresence mode="wait">
            {isDisconnected && (
                <motion.div
                    key="disconnected"
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    className="fixed top-0 left-0 right-0 z-[9999] flex justify-center p-4 pointer-events-none"
                >
                    <div className="bg-white dark:bg-[#1a1d23] border-l-4 border-amber-500 shadow-2xl rounded-xl p-4 flex items-center gap-4 max-w-md pointer-events-auto border border-slate-200 dark:border-slate-700/30">
                        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center shrink-0">
                            {isOffline ? (
                                <WifiOff className="w-6 h-6 text-amber-600" />
                            ) : (
                                <RefreshCw className="w-6 h-6 text-amber-600 animate-spin" />
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                                {t('connection_lost')}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {t('connection_lost_desc')}
                            </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                            {isBackendDown && (
                                <button 
                                    onClick={() => window.location.reload()}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-amber-600 font-bold text-xs flex items-center gap-1"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    {t('try_again')}
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}

            {showRestored && !isDisconnected && (
                <motion.div
                    key="restored"
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-[9999] flex justify-center p-4"
                >
                    <div className="bg-emerald-500 text-white shadow-xl rounded-full px-6 py-2 flex items-center gap-2 border border-emerald-400">
                        <Wifi className="w-4 h-4" />
                        <span className="text-sm font-bold">{t('connection_restored')}</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
