import React from 'react';
import { Box, X } from 'lucide-react';
import { Button } from '../common/Button';

interface PopHeaderProps {
    title: string;
    onClose: () => void;
    userRole?: string | null;
}

export const PopHeader: React.FC<PopHeaderProps> = ({ title, onClose, userRole }) => {
    return (
        <div className="h-14 bg-[#1a1d23] border-b border-slate-700/50 flex items-center justify-between px-6 shrink-0 z-50">
            <div className="flex items-center gap-4 min-w-0 flex-1">
                <h2 className="font-bold text-slate-200 text-lg flex items-center gap-3 whitespace-nowrap truncate min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                        <Box className="w-5 h-5 text-indigo-400 shrink-0" />
                    </div>
                    <span className="truncate">{title}</span>
                </h2>
            </div>
            <div className="flex gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 text-slate-500 hover:text-rose-400"
                >
                    <X className="w-5 h-5" />
                </Button>
            </div>
        </div>
    );
};
