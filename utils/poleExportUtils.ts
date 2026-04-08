import { PoleData, CableData, CTOData, PoleApprovalStatus, PoleSituation } from '../types';
import { PoleCatalogItem } from '../services/catalogService';

// Helper to resolve pole fields from catalog
function resolvePole(pole: PoleData, catalogMap: Map<string, PoleCatalogItem>) {
    const cat = pole.catalogId ? catalogMap.get(pole.catalogId) : undefined;
    return {
        type: pole.type || cat?.type || '-',
        shape: pole.shape || cat?.shape || '-',
        height: pole.height || cat?.height,
        strength: pole.strength || cat?.strength,
    };
}

// ===================== EXCEL (CSV) EXPORT =====================

const SITUATION_LABELS: Record<string, string> = {
    EXISTING: 'Existente',
    NEW: 'Novo',
    SHARED: 'Compartilhado',
    REPLACE: 'Substituir',
};

const APPROVAL_LABELS: Record<string, string> = {
    APPROVED: 'Aprovado',
    PENDING: 'Pendente',
    IRREGULAR: 'Irregular',
};

const ROAD_SIDE_LABELS: Record<string, string> = {
    LEFT: 'Esquerdo',
    RIGHT: 'Direito',
};

export function exportPolesToCSV(poles: PoleData[], cables: CableData[], ctos: CTOData[], catalog: PoleCatalogItem[] = []) {
    const catalogMap = new Map(catalog.map(c => [c.id, c]));
    const headers = [
        'Poste', 'Cód. Concessionária', 'Tipo', 'Formato', 'Altura (m)', 'Esforço (daN)',
        'Situação', 'Status Aprovação', 'Lado da Rua', 'Latitude', 'Longitude',
        'Endereço Referência', 'Cabos Vinculados', 'CTO/Caixa', 'Possui Foto', 'Observações'
    ];

    const rows = poles.map(pole => {
        const linkedCables = cables.filter(c => pole.linkedCableIds?.includes(c.id));
        const linkedCTOs = ctos.filter(c => c.poleId === pole.id);
        const resolved = resolvePole(pole, catalogMap);

        return [
            pole.name,
            pole.utilityCode || '',
            resolved.type,
            resolved.shape,
            resolved.height ? String(resolved.height) : '',
            resolved.strength ? String(resolved.strength) : '',
            pole.situation ? SITUATION_LABELS[pole.situation] || pole.situation : '',
            APPROVAL_LABELS[pole.approvalStatus || 'PENDING'] || 'Pendente',
            pole.roadSide ? ROAD_SIDE_LABELS[pole.roadSide] || pole.roadSide : '',
            pole.coordinates.lat.toFixed(6),
            pole.coordinates.lng.toFixed(6),
            pole.addressReference || '',
            linkedCables.map(c => c.name).join('; '),
            linkedCTOs.map(c => c.name).join('; '),
            pole.hasPhoto ? 'Sim' : 'Não',
            pole.observations || '',
        ];
    });

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `postes_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ===================== PDF REPORT =====================

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function generatePoleReportHTML(
    poles: PoleData[],
    cables: CableData[],
    ctos: CTOData[],
    projectName: string,
    catalog: PoleCatalogItem[] = []
): string {
    const catalogMap = new Map(catalog.map(c => [c.id, c]));
    const totalPoles = poles.length;
    const newPoles = poles.filter(p => p.situation === 'NEW').length;
    const existingPoles = poles.filter(p => p.situation === 'EXISTING').length;
    const sharedPoles = poles.filter(p => p.situation === 'SHARED').length;
    const replacePoles = poles.filter(p => p.situation === 'REPLACE').length;
    const approvedPoles = poles.filter(p => p.approvalStatus === 'APPROVED').length;
    const pendingPoles = poles.filter(p => !p.approvalStatus || p.approvalStatus === 'PENDING').length;
    const irregularPoles = poles.filter(p => p.approvalStatus === 'IRREGULAR').length;

    const totalCTOs = ctos.filter(c => (c as any).type !== 'CEO').length;
    const totalCEOs = ctos.filter(c => (c as any).type === 'CEO').length;

    // Total cable length
    let totalCableLength = 0;
    for (const cable of cables) {
        const coords = cable.coordinates as any[];
        if (coords && coords.length >= 2) {
            for (let i = 1; i < coords.length; i++) {
                const p1 = coords[i - 1];
                const p2 = coords[i];
                const lat1 = p1.lat ?? p1[0];
                const lng1 = p1.lng ?? p1[1];
                const lat2 = p2.lat ?? p2[0];
                const lng2 = p2.lng ?? p2[1];
                totalCableLength += haversineDistance(lat1, lng1, lat2, lng2);
            }
        }
    }

    // Average distance between poles
    let totalDist = 0;
    let distCount = 0;
    const sortedPoles = [...poles].sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < sortedPoles.length; i++) {
        for (let j = i + 1; j < sortedPoles.length; j++) {
            const p1 = sortedPoles[i];
            const p2 = sortedPoles[j];
            // Only calc for poles that share a cable
            const shared = (p1.linkedCableIds || []).some(id => (p2.linkedCableIds || []).includes(id));
            if (shared) {
                totalDist += haversineDistance(p1.coordinates.lat, p1.coordinates.lng, p2.coordinates.lat, p2.coordinates.lng);
                distCount++;
            }
        }
    }
    const avgDist = distCount > 0 ? Math.round(totalDist / distCount) : 0;

    const tableRows = poles.map(pole => {
        const linkedCables = cables.filter(c => pole.linkedCableIds?.includes(c.id));
        const linkedCTOs = ctos.filter(c => c.poleId === pole.id);
        const resolved = resolvePole(pole, catalogMap);
        const approvalColor = pole.approvalStatus === 'APPROVED' ? '#16a34a' : pole.approvalStatus === 'IRREGULAR' ? '#dc2626' : '#ca8a04';
        return `<tr>
            <td><strong>${pole.name}</strong></td>
            <td>${pole.utilityCode || '-'}</td>
            <td>${resolved.type}</td>
            <td>${resolved.shape}</td>
            <td>${resolved.height ? resolved.height + 'm' : '-'}</td>
            <td>${resolved.strength ? resolved.strength + ' daN' : '-'}</td>
            <td>${pole.situation ? SITUATION_LABELS[pole.situation] || pole.situation : '-'}</td>
            <td style="color: ${approvalColor}; font-weight: bold;">${APPROVAL_LABELS[pole.approvalStatus || 'PENDING']}</td>
            <td>${pole.roadSide ? ROAD_SIDE_LABELS[pole.roadSide] || pole.roadSide : '-'}</td>
            <td>${linkedCables.map(c => c.name).join(', ') || '-'}</td>
            <td>${linkedCTOs.map(c => c.name).join(', ') || '-'}</td>
            <td>${pole.coordinates.lat.toFixed(6)}</td>
            <td>${pole.coordinates.lng.toFixed(6)}</td>
            <td>${pole.hasPhoto ? 'Sim' : 'Não'}</td>
            <td>${pole.addressReference || '-'}</td>
            <td>${pole.observations || '-'}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Memorial Descritivo - ${projectName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.6; padding: 40px; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #10b981; padding-bottom: 20px; }
        .header h1 { font-size: 22px; color: #0f172a; }
        .header p { color: #64748b; font-size: 12px; margin-top: 4px; }
        .section { margin-bottom: 30px; }
        .section h2 { font-size: 16px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
        .stat-card .value { font-size: 28px; font-weight: 800; color: #0f172a; }
        .stat-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; }
        th { background: #f1f5f9; color: #475569; text-transform: uppercase; font-size: 8px; letter-spacing: 0.3px; padding: 6px 4px; text-align: left; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
        td { padding: 5px 4px; border-bottom: 1px solid #f1f5f9; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
        tr:hover td { background: #f8fafc; }
        .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
        @page { size: landscape; margin: 10mm; }
        @media print { body { padding: 10px; } .stats-grid { grid-template-columns: repeat(4, 1fr); } table { font-size: 8px; } th, td { padding: 3px; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Memorial Descritivo - Rede FTTH</h1>
        <p>Projeto: ${projectName} | Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
    </div>

    <div class="section">
        <h2>Resumo do Projeto</h2>
        <div class="stats-grid">
            <div class="stat-card"><div class="value">${totalPoles}</div><div class="label">Total de Postes</div></div>
            <div class="stat-card"><div class="value" style="color:#3b82f6">${newPoles}</div><div class="label">Postes Novos</div></div>
            <div class="stat-card"><div class="value">${existingPoles}</div><div class="label">Postes Existentes</div></div>
            <div class="stat-card"><div class="value" style="color:#f97316">${replacePoles}</div><div class="label">Postes p/ Substituir</div></div>
            <div class="stat-card"><div class="value" style="color:#22c55e">${approvedPoles}</div><div class="label">Aprovados</div></div>
            <div class="stat-card"><div class="value" style="color:#eab308">${pendingPoles}</div><div class="label">Pendentes</div></div>
            <div class="stat-card"><div class="value" style="color:#ef4444">${irregularPoles}</div><div class="label">Irregulares</div></div>
            <div class="stat-card"><div class="value">${sharedPoles}</div><div class="label">Compartilhados</div></div>
            <div class="stat-card"><div class="value">${Math.round(totalCableLength)}m</div><div class="label">Comprimento Total Rede</div></div>
            <div class="stat-card"><div class="value">${totalCTOs}</div><div class="label">CTOs Instaladas</div></div>
            <div class="stat-card"><div class="value">${totalCEOs}</div><div class="label">CEOs</div></div>
            <div class="stat-card"><div class="value">${avgDist}m</div><div class="label">Distância Média entre Postes</div></div>
        </div>
    </div>

    <div class="section">
        <h2>Tabela de Postes</h2>
        <table>
            <thead>
                <tr>
                    <th>Poste</th>
                    <th>Cód. Conc.</th>
                    <th>Tipo</th>
                    <th>Formato</th>
                    <th>Altura</th>
                    <th>Esforço</th>
                    <th>Situação</th>
                    <th>Aprovação</th>
                    <th>Lado</th>
                    <th>Cabo</th>
                    <th>CTO/Caixa</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Foto</th>
                    <th>Endereço Ref.</th>
                    <th>Observações</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
    </div>

    <div class="footer">
        <p>Documento gerado automaticamente pelo FTTH Planner</p>
    </div>
</body>
</html>`;
}

export function exportPoleReportPDF(
    poles: PoleData[],
    cables: CableData[],
    ctos: CTOData[],
    projectName: string,
    catalog: PoleCatalogItem[] = []
) {
    const html = generatePoleReportHTML(poles, cables, ctos, projectName, catalog);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    }
}
