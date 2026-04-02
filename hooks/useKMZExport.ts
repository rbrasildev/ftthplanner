import { useState, useCallback } from 'react';
import { useLanguage } from '../LanguageContext';
import { ExportKMZOptions } from '../components/modals/ExportKMZModal';

export const useKMZExport = () => {
    const [isExporting, setIsExporting] = useState(false);
    const { t } = useLanguage();

    const exportToKMZ = useCallback((projectData: any, options: ExportKMZOptions, showToast: (msg: string, type?: 'success' | 'error' | 'info') => void) => {
        if (!projectData) {
            showToast(t('error_no_project_data') || 'Nenhum dado do projeto encontrado.', 'error');
            return;
        }

        setIsExporting(true);
        showToast(t('toast_kmz_start') || 'Gerando arquivo KMZ...', 'info');

        // Initialize Web Worker using Vite standard worker import behavior
        // The query ?worker tells Vite how to bundle it
        const worker = new Worker(new URL('../workers/exportKMZWorker.ts', import.meta.url), { type: 'module' });

        worker.onmessage = (e) => {
            const { success, blob, error } = e.data;
            setIsExporting(false);
            worker.terminate();

            if (success && blob) {
                // Create object URL and trigger download
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${projectData.projectName || 'Projeto'}_${new Date().toISOString().slice(0, 10)}.kmz`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast(t('toast_kmz_success') || 'Arquivo KMZ gerado com sucesso!', 'success');
            } else {
                console.error("Worker error:", error);
                showToast(t('toast_kmz_error', { error: String(error) }) || `Erro ao exportar KMZ: ${error}`, 'error');
            }
        };

        worker.onerror = (error) => {
            console.error("Worker generic error:", error);
            setIsExporting(false);
            showToast(t('toast_kmz_error_start') || 'Erro ao iniciar exportação KMZ.', 'error');
            worker.terminate();
        };

        // Dispatch data to worker
        worker.postMessage({
            projectName: projectData.projectName,
            nodes: projectData.nodes,
            cables: projectData.cables,
            pops: projectData.pops,
            poles: projectData.poles,
            customers: projectData.customers,
            options,
            polygon: projectData.polygon
        });
    }, [t]);

    return { exportToKMZ, isExporting };
};
