import React, { useRef } from 'react';
import { X, QrCode, Printer, Download, ExternalLink } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import html2canvas from 'html2canvas';

interface QRCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    ctoId: string;
    projectId: string;
    ctoName: string;
    logo?: string | null;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, ctoId, projectId, ctoName, logo }) => {
    const { t } = useLanguage();
    const qrContainerRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const diagramUrl = `${window.location.origin}/cto/${ctoId}?projectId=${projectId}&download=true&downloadType=png`;
    const qrCodeContent = ctoName;
    const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrCodeContent)}&ecc=H`;

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const generatedAt = t('generated_at_system', { 
            system: 'FTTHPlanner', 
            date: new Date().toLocaleDateString() 
        });

        printWindow.document.write(`
            <html>
                <head>
                    <title>${t('qr_code')} - ${ctoName}</title>
                    <style>
                        body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; margin: 0; padding: 20px; }
                        .container { border: 2px dashed #ccc; padding: 40px; border-radius: 20px; text-align: center; }
                        h1 { margin-bottom: 20px; font-size: 28px; color: #333; }
                        .qr-wrapper { position: relative; display: inline-block; }
                        img.qr { width: 300px; height: 300px; margin: 20px 0; }
                        .logo-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 6px; border-radius: 8px; border: 1px solid #eee; display: ${logo ? 'block' : 'none'}; }
                        .logo-overlay img { width: 50px; height: 50px; object-fit: contain; }
                        p { color: #666; font-size: 16px; margin-top: 10px; }
                        .footer { margin-top: 30px; font-size: 12px; color: #999; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>${t('cto_label')}: ${ctoName}</h1>
                        <div class="qr-wrapper">
                            <img src="${qrCodeApiUrl}" class="qr" />
                            ${logo ? `
                            <div class="logo-overlay">
                                <img src="${logo}" />
                            </div>
                            ` : ''}
                        </div>
                        <p>${t('cto_diagram_scan')}</p>
                        <div class="footer">${generatedAt}</div>
                    </div>
                    <script>
                        window.onload = () => {
                            setTimeout(() => { 
                                window.print(); 
                                window.close(); 
                            }, 1000);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleDownload = async () => {
        if (!qrContainerRef.current) return;
        
        try {
            const canvas = await html2canvas(qrContainerRef.current, {
                backgroundColor: null,
                scale: 2, // Better quality
                useCORS: true
            });
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `qr-${ctoName}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error generating QR code image:', error);
        }
    };

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                            {t('qr_maintenance')}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 flex flex-col items-center gap-6">
                    <div 
                        ref={qrContainerRef}
                        className="bg-white p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 shadow-inner group transition-all relative"
                    >
                        <img 
                            src={qrCodeApiUrl} 
                            alt="QR Code" 
                            className="w-48 h-48 sm:w-64 sm:h-64 rounded-lg bg-white p-2"
                        />
                        {logo && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="bg-white p-1 rounded-lg shadow-md border border-slate-100">
                                    <img 
                                        src={logo} 
                                        alt="Logo" 
                                        className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-md"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="text-center">
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">{ctoName}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[280px]">
                            {t('qr_maintenance_desc')}
                        </p>
                    </div>

                    <div className="flex gap-3 w-full mt-2">
                        <button
                            onClick={handlePrint}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-emerald-200/50"
                        >
                            <Printer className="w-4 h-4" />
                            {t('print')}
                        </button>
                        <button
                            onClick={handleDownload}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all"
                        >
                            <Download className="w-4 h-4" />
                            {t('download')}
                        </button>
                    </div>

                    <a 
                        href={diagramUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] text-slate-400 hover:text-emerald-500 font-medium transition-colors flex items-center gap-1 group"
                    >
                        <ExternalLink className="w-2.5 h-2.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        {t('download_diagram_png')}
                    </a>
                </div>
            </div>
        </div>
    );
};
