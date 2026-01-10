
import api from './api';

export interface BackupFile {
    filename: string;
    size: number;
    createdAt: string;
}

export const listBackups = async (): Promise<BackupFile[]> => {
    const res = await api.get<BackupFile[]>('/backups');
    return res.data;
};

export const createBackup = async (): Promise<BackupFile> => {
    const res = await api.post<BackupFile>('/backups', {});
    return res.data;
};


export const restoreBackup = async (filename: string): Promise<void> => {
    // Or use 'api' instance which already has base URL
    // But api instance processes responses, and we need to check !response.ok manually?
    // Actually api.post throws on error usually.
    // Let's stick to fetch if we want raw control or switch to api.
    // Given the error 'Cannot find AP_URL', we must import it or hardcode.
    // Let's use the 'api' instance we imported at the top.
    await api.post(`/backups/${filename}/restore`);
};

export const uploadAndRestore = async (fileTrace: File): Promise<void> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const jsonContent = JSON.parse(e.target?.result as string);

                await api.post('/backups/upload-restore', { data: jsonContent });

                resolve();
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(fileTrace);
    });
};

export const deleteBackup = async (filename: string): Promise<void> => {
    await api.delete(`/backups/${filename}`);
};


export const downloadBackupFile = async (filename: string): Promise<void> => {
    const response = await api.get(`/backups/${filename}/download`, {
        responseType: 'blob'
    });

    // Create blob link to download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
};

