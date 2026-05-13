import writeXlsxFile from 'write-excel-file/browser';
import L from 'leaflet';
import { CTOData, POPData, CableData, PoleData, Customer, NetworkState } from '../types';
import { getEffectiveCableType } from './cableTypeUtils';

export interface ReportSelection {
    ctos: CTOData[];     // inclui CEOs (mesmo tipo, distinguido por `type`)
    pops: POPData[];
    cables: CableData[];
    poles: PoleData[];
    customers: Customer[];
}

// write-excel-file v4 espera Cell[][]. Cada célula precisa de type explícito
// (String/Number/Boolean) — undefined/null não são aceitos, então normalizamos.
type Primitive = string | number | boolean | null | undefined;

function cell(value: Primitive): any {
    if (value === null || value === undefined) {
        return { type: String, value: '' };
    }
    if (typeof value === 'number') return { type: Number, value };
    if (typeof value === 'boolean') return { type: Boolean, value };
    return { type: String, value: String(value) };
}

function header(label: string): any {
    return { value: label, fontWeight: 'bold' };
}

function buildSheet(columns: string[], rows: Primitive[][]): any[][] {
    return [
        columns.map(header),
        ...rows.map(r => r.map(cell)),
    ];
}

function cableLengthMeters(cable: CableData): number {
    const coords = cable.coordinates;
    if (!coords || coords.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
        total += L.latLng(coords[i - 1]).distanceTo(L.latLng(coords[i]));
    }
    return Math.round(total);
}

function ctoSheet(items: CTOData[]): any[][] {
    return buildSheet(
        ['Nome', 'Tipo', 'Status', 'Clientes', 'Splitters', 'Latitude', 'Longitude'],
        items.map(c => [
            c.name,
            c.type || 'CTO',
            c.status,
            c.clientCount || 0,
            (c.splitters || []).length,
            c.coordinates.lat,
            c.coordinates.lng,
        ])
    );
}

function popSheet(items: POPData[]): any[][] {
    return buildSheet(
        ['Nome', 'Status', 'OLTs', 'DIOs', 'Switches', 'Latitude', 'Longitude'],
        items.map(p => [
            p.name,
            p.status,
            (p.olts || []).length,
            (p.dios || []).length,
            (p.switches || []).length,
            p.coordinates.lat,
            p.coordinates.lng,
        ])
    );
}

function cableSheet(items: CableData[]): any[][] {
    return buildSheet(
        ['Nome', 'Tipo', 'Fibras', 'Status', 'Comprimento (m)', 'Cor'],
        items.map(c => [
            c.name,
            getEffectiveCableType(c) || '',
            c.fiberCount,
            c.status,
            cableLengthMeters(c),
            c.color || '',
        ])
    );
}

function poleSheet(items: PoleData[]): any[][] {
    return buildSheet(
        ['Nome', 'Status', 'Altura', 'Concessionária', 'Situação', 'Latitude', 'Longitude'],
        items.map(p => [
            p.name,
            p.status,
            p.height ?? '',
            p.utilityCode || '',
            p.situation || '',
            p.coordinates.lat,
            p.coordinates.lng,
        ])
    );
}

function customerSheet(items: Customer[], network: NetworkState): any[][] {
    const ctoById = new Map(network.ctos.map(c => [c.id, c.name]));
    return buildSheet(
        ['Nome', 'Documento', 'Telefone', 'Email', 'Status', 'CTO/CEO', 'Endereço', 'Latitude', 'Longitude'],
        items.map(c => [
            c.name,
            c.document || '',
            c.phone || '',
            c.email || '',
            c.status,
            c.ctoId ? (ctoById.get(c.ctoId) || c.ctoId) : '',
            c.address || '',
            c.lat,
            c.lng,
        ])
    );
}

function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function generateReportXLSX(selection: ReportSelection, network: NetworkState, projectName: string) {
    const ctosOnly = selection.ctos.filter(c => (c.type || 'CTO') === 'CTO');
    const ceosOnly = selection.ctos.filter(c => c.type === 'CEO');

    // Ordem fixa; abas vazias são descartadas. write-excel-file v4 exige ao menos 1 sheet.
    const sheets: Array<{ name: string; data: any[][] }> = [];
    if (ctosOnly.length > 0) sheets.push({ name: 'CTOs', data: ctoSheet(ctosOnly) });
    if (ceosOnly.length > 0) sheets.push({ name: 'CEOs', data: ctoSheet(ceosOnly) });
    if (selection.pops.length > 0) sheets.push({ name: 'POPs', data: popSheet(selection.pops) });
    if (selection.cables.length > 0) sheets.push({ name: 'Cabos', data: cableSheet(selection.cables) });
    if (selection.poles.length > 0) sheets.push({ name: 'Postes', data: poleSheet(selection.poles) });
    if (selection.customers.length > 0) sheets.push({ name: 'Clientes', data: customerSheet(selection.customers, network) });

    const ts = new Date().toISOString().slice(0, 10);
    const safeName = (projectName || 'relatorio').replace(/[^\w\-]+/g, '_');
    const fileName = `${safeName}_${ts}.xlsx`;

    let blob: Blob;
    if (sheets.length === 0) {
        blob = await writeXlsxFile([[{ value: 'Nenhum item selecionado', type: String }]]).toBlob();
    } else if (sheets.length === 1) {
        blob = await writeXlsxFile(sheets[0].data, { sheet: sheets[0].name }).toBlob();
    } else {
        // v4 multi-sheet: array de { data, sheet }
        blob = await writeXlsxFile(
            sheets.map(s => ({ data: s.data, sheet: s.name }))
        ).toBlob();
    }
    downloadBlob(blob, fileName);
}
