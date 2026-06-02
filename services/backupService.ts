
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

export const uploadAndRestore = async (file: File): Promise<void> => {
    const name = file.name.toLowerCase();
    const isBinary = name.endsWith('.gz') || name.endsWith('.gz.enc') || name.endsWith('.enc');

    if (isBinary) {
        // Envia binário cru — server detecta formato pelo nome e decodifica.
        // Usado quando o usuário tem o arquivo direto do disco do servidor
        // (.json.gz ou .json.gz.enc), em vez do .json baixado pelo painel.
        const buffer = await file.arrayBuffer();
        await api.post('/backups/upload-restore', buffer, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'X-Backup-Filename': file.name
            }
        });
        return;
    }

    // JSON plain (formato baixado pelo painel) — parse client-side e envia
    // como JSON body. Mais leve (sem overhead de body parser raw).
    const text = await file.text();
    const jsonContent = JSON.parse(text);
    await api.post('/backups/upload-restore', { data: jsonContent });
};

export const deleteBackup = async (filename: string): Promise<void> => {
    await api.delete(`/backups/${filename}`);
};


export const downloadBackupFile = async (filename: string): Promise<void> => {
    const response = await api.get(`/backups/${filename}/download`, {
        responseType: 'blob'
    });

    // Server decifra + descomprime e envia JSON plano — usuário precisa salvar
    // com .json (não a extensão original .json.gz/.json.gz.enc). Browser
    // privilegia o atributo `download` do <a> sobre Content-Disposition, então
    // normalizamos aqui pra evitar o usuário salvar com extensão enganosa.
    const downloadName = filename.replace(/\.(json\.gz\.enc|json\.gz|json)$/, '.json');

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', downloadName);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
};

