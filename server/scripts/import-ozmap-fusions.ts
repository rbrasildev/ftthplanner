/**
 * Importa SOMENTE o diagrama de fusão (splitters + connections) de um dump
 * OZMap pra um projeto FTTH Planner ONDE OS CTOs E CABOS JÁ EXISTEM.
 *
 * Diferente do import-ozmap.ts (full import), este script:
 *   - NÃO cria/altera CTOs, POPs, cabos
 *   - SÓ atualiza splitters[] e connections[] de cada CTO existente
 *   - Faz matching por NOME (CTO.name) e por (CTO de origem + CTO de destino + fiberCount) pros cabos
 *
 * Matching:
 *   - OZMap box → FTTH CTO: exato por name; fallback lat/lng (<50m)
 *   - OZMap cable → FTTH cable: par de CTOs conectados (independente da direção) + fiberCount
 *   - OZMap fiber → FTTH `${cableId}-fiber-${N}` (N do OZMap)
 *   - OZMap splitter port → FTTH `${splitterId}-in` ou `${splitterId}-out-${idx}`
 *
 * Estratégia: pra cada CTO mapeado, sobrescreve splitters[] e connections[]
 * com o que veio do OZMap. CTOs que não bateram ficam intocados. Log final
 * mostra quantos mapeou e quantos ficaram órfãos.
 *
 * Rodar:
 *   cd server
 *   npx ts-node scripts/import-ozmap-fusions.ts <sqlFilePath> <projectId>
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// -----------------------------------------------------------------------------
// Parser SQL (mesmo do import-ozmap.ts — extraído pra reuso futuro)
// -----------------------------------------------------------------------------

type Row = (string | number | null)[];

function parseTuple(s: string): Row {
    const out: Row = [];
    let i = 0;
    const n = s.length;
    while (i < n) {
        while (i < n && /\s/.test(s[i])) i++;
        if (i >= n) break;
        if (s[i] === "'") {
            i++;
            let val = '';
            while (i < n) {
                if (s[i] === '\\' && i + 1 < n) { val += s[i + 1]; i += 2; }
                else if (s[i] === "'") {
                    if (i + 1 < n && s[i + 1] === "'") { val += "'"; i += 2; }
                    else break;
                } else { val += s[i]; i++; }
            }
            i++;
            out.push(val);
        } else if (s.substr(i, 4).toUpperCase() === 'NULL') {
            out.push(null);
            i += 4;
        } else {
            let val = '';
            while (i < n && s[i] !== ',' && s[i] !== ')') { val += s[i]; i++; }
            val = val.trim();
            if (val === '') out.push(null);
            else { const num = Number(val); out.push(isNaN(num) ? val : num); }
        }
        while (i < n && (s[i] === ',' || /\s/.test(s[i]))) i++;
    }
    return out;
}

function extractTuples(valuesBlock: string): string[] {
    const tuples: string[] = [];
    let depth = 0, inString = false, escape = false, start = -1;
    for (let i = 0; i < valuesBlock.length; i++) {
        const c = valuesBlock[i];
        if (escape) { escape = false; continue; }
        if (inString) {
            if (c === '\\') { escape = true; continue; }
            if (c === "'") {
                if (i + 1 < valuesBlock.length && valuesBlock[i + 1] === "'") { i++; continue; }
                inString = false;
            }
            continue;
        }
        if (c === "'") { inString = true; continue; }
        if (c === '(') { if (depth === 0) start = i + 1; depth++; }
        else if (c === ')') {
            depth--;
            if (depth === 0 && start >= 0) { tuples.push(valuesBlock.slice(start, i)); start = -1; }
        }
    }
    return tuples;
}

function parseDump(sql: string): Record<string, Row[]> {
    const result: Record<string, Row[]> = {};
    const insertRe = /INSERT\s+INTO\s+`(\w+)`\s*\([^)]+\)\s*VALUES\s*([\s\S]*?);/gi;
    let m: RegExpExecArray | null;
    while ((m = insertRe.exec(sql)) !== null) {
        const table = m[1];
        const tuples = extractTuples(m[2]);
        if (!result[table]) result[table] = [];
        result[table].push(...tuples.map(parseTuple));
    }
    return result;
}

// -----------------------------------------------------------------------------
// Distância haversine pra fallback de matching
// -----------------------------------------------------------------------------

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
    const [, , sqlPath, projectId, ctoFilter] = process.argv;
    if (!sqlPath || !projectId) {
        console.error('Uso: ts-node import-ozmap-fusions.ts <sqlFilePath> <projectId> [ctoName]');
        console.error('     ctoName opcional — se passar, só processa essa CTO (modo debug)');
        process.exit(1);
    }
    const filterName = ctoFilter ? ctoFilter.trim().toUpperCase() : null;
    if (filterName) console.log(`[FusionImport] Modo debug — só CTO "${filterName}"`);
    const absSqlPath = path.resolve(sqlPath);
    if (!fs.existsSync(absSqlPath)) {
        console.error(`Arquivo não encontrado: ${absSqlPath}`);
        process.exit(1);
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
        console.error(`Projeto não encontrado: ${projectId}`);
        process.exit(1);
    }
    console.log(`[FusionImport] Projeto destino: ${project.name} (${projectId})`);

    // -------------------------------------------------------------------------
    // 1. Parse OZMap SQL
    // -------------------------------------------------------------------------
    console.log('[FusionImport] Lendo SQL...');
    const tables = parseDump(fs.readFileSync(absSqlPath, 'utf-8'));

    interface OzBox { id: string; name: string; level: number; lat: number; lng: number; }
    interface OzCable { id: string; name: string; boxA: string; boxB: string; fiberCount: number; }
    interface OzFiber { id: string; cableId: string; fiberNumber: number; }
    interface OzFusion { id: string; boxId: string; a: string | null; b: string | null; }
    interface OzSplitter { id: string; boxId: string; ratioIn: number; ratioOut: number; input: string | null; }
    interface OzSplitterOutput { splitterId: string; portIndex: number; connectable: string | null; }

    const ozBoxes: OzBox[] = (tables.oz_box || []).map(r => ({
        id: r[0] as string, name: r[1] as string, level: r[3] as number,
        lat: r[7] as number, lng: r[8] as number,
    }));
    const ozCables: OzCable[] = (tables.oz_cable || []).map(r => ({
        id: r[0] as string, name: (r[1] as string) || '',
        boxA: r[3] as string, boxB: r[4] as string, fiberCount: r[5] as number,
    }));
    const ozFibers: OzFiber[] = (tables.oz_fiber || []).map(r => ({
        id: r[0] as string, fiberNumber: r[2] as number, cableId: r[3] as string,
    }));
    const ozFusions: OzFusion[] = (tables.oz_fusion || []).map(r => ({
        id: r[0] as string, boxId: r[2] as string,
        a: r[3] as string | null, b: r[4] as string | null,
    }));
    const ozSplitters: OzSplitter[] = (tables.oz_splitter || []).map(r => ({
        id: r[0] as string, boxId: r[2] as string,
        ratioIn: r[4] as number, ratioOut: r[5] as number, input: r[7] as string | null,
    }));
    const ozSplitterOutputs: OzSplitterOutput[] = (tables.oz_splitter_output || []).map(r => ({
        splitterId: r[0] as string, portIndex: r[1] as number, connectable: r[2] as string | null,
    }));

    console.log(`[FusionImport] OZMap: ${ozBoxes.length} boxes, ${ozCables.length} cabos, ${ozFusions.length} fusões, ${ozSplitters.length} splitters`);

    // -------------------------------------------------------------------------
    // 2. Carrega estado atual do FTTH Planner
    // -------------------------------------------------------------------------
    console.log('[FusionImport] Carregando estado atual do projeto FTTH...');
    const ftthCtos = await prisma.cto.findMany({
        where: { projectId, deletedAt: null },
        select: { id: true, name: true, lat: true, lng: true },
    });
    const ftthCables = await prisma.cable.findMany({
        where: { projectId, deletedAt: null },
        select: { id: true, name: true, fromNodeId: true, toNodeId: true, fiberCount: true, coordinates: true },
    });
    console.log(`[FusionImport] FTTH: ${ftthCtos.length} CTOs, ${ftthCables.length} cabos`);

    // -------------------------------------------------------------------------
    // 3. Matching OZMap box → FTTH CTO
    // -------------------------------------------------------------------------
    const boxIdToFtthCtoId = new Map<string, string>();
    const ftthCtosByName = new Map<string, typeof ftthCtos[number]>();
    ftthCtos.forEach(c => ftthCtosByName.set(c.name.trim().toUpperCase(), c));

    const unmappedBoxes: OzBox[] = [];
    ozBoxes.forEach(b => {
        if (b.level !== 2 && b.level !== 3) return;
        // exato por nome
        const byName = ftthCtosByName.get(b.name.trim().toUpperCase());
        if (byName) {
            boxIdToFtthCtoId.set(b.id, byName.id);
            return;
        }
        // fallback: lat/lng < 50m
        let bestDist = Infinity, bestId: string | null = null;
        for (const c of ftthCtos) {
            const d = distanceMeters(b.lat, b.lng, c.lat, c.lng);
            if (d < bestDist) { bestDist = d; bestId = c.id; }
        }
        if (bestId && bestDist < 50) {
            boxIdToFtthCtoId.set(b.id, bestId);
        } else {
            unmappedBoxes.push(b);
        }
    });

    console.log(`[FusionImport] Boxes mapeados: ${boxIdToFtthCtoId.size}, não mapeados: ${unmappedBoxes.length}`);
    if (unmappedBoxes.length > 0) {
        console.log('  Não mapeados (primeiros 10):');
        unmappedBoxes.slice(0, 10).forEach(b => console.log(`    - ${b.name} (${b.lat.toFixed(5)}, ${b.lng.toFixed(5)})`));
    }

    // -------------------------------------------------------------------------
    // 4. Matching OZMap cable → FTTH cable (3 estratégias em cascata)
    //    a) Nome exato (case-insensitive)
    //    b) fromNodeId/toNodeId (par de CTOs FTTH) + fiberCount
    //    c) Endpoints de coords próximos das caixas OZMap (<30m) + fiberCount
    // -------------------------------------------------------------------------
    const cableIdToFtthCableId = new Map<string, string>();
    const cableMatchReason = new Map<string, string>();
    const consumed = new Set<string>();
    const ozBoxById = new Map<string, OzBox>();
    ozBoxes.forEach(b => ozBoxById.set(b.id, b));

    // Index FTTH cables por nome normalizado
    const ftthCablesByName = new Map<string, typeof ftthCables>();
    ftthCables.forEach(c => {
        const n = (c.name || '').trim().toLowerCase();
        if (!n) return;
        if (!ftthCablesByName.has(n)) ftthCablesByName.set(n, []);
        ftthCablesByName.get(n)!.push(c);
    });

    // Index FTTH cables por par de nodes ordenado + fiberCount
    const ftthCablesByNodePair = new Map<string, typeof ftthCables>();
    ftthCables.forEach(c => {
        if (!c.fromNodeId || !c.toNodeId) return;
        const k = [c.fromNodeId, c.toNodeId].sort().join('|') + '|' + c.fiberCount;
        if (!ftthCablesByNodePair.has(k)) ftthCablesByNodePair.set(k, []);
        ftthCablesByNodePair.get(k)!.push(c);
    });

    function getCableEndpoints(c: typeof ftthCables[number]): { first: { lat: number; lng: number } | null; last: { lat: number; lng: number } | null } {
        try {
            const coords = c.coordinates as any;
            if (!Array.isArray(coords) || coords.length === 0) return { first: null, last: null };
            return { first: coords[0], last: coords[coords.length - 1] };
        } catch { return { first: null, last: null }; }
    }

    let unmappedCables = 0;
    const unmappedCablesList: OzCable[] = [];
    ozCables.forEach(oc => {
        // (a) nome
        if (oc.name) {
            const cands = ftthCablesByName.get(oc.name.trim().toLowerCase()) || [];
            const free = cands.find(c => !consumed.has(c.id) && c.fiberCount === oc.fiberCount);
            if (free) {
                consumed.add(free.id);
                cableIdToFtthCableId.set(oc.id, free.id);
                cableMatchReason.set(oc.id, 'name');
                return;
            }
        }
        // (b) node pair
        const fromCtoId = boxIdToFtthCtoId.get(oc.boxA);
        const toCtoId = boxIdToFtthCtoId.get(oc.boxB);
        if (fromCtoId && toCtoId) {
            const k = [fromCtoId, toCtoId].sort().join('|') + '|' + oc.fiberCount;
            const cands = ftthCablesByNodePair.get(k) || [];
            const free = cands.find(c => !consumed.has(c.id));
            if (free) {
                consumed.add(free.id);
                cableIdToFtthCableId.set(oc.id, free.id);
                cableMatchReason.set(oc.id, 'nodes');
                return;
            }
        }
        // (c) endpoints próximos das caixas
        const boxA = ozBoxById.get(oc.boxA);
        const boxB = ozBoxById.get(oc.boxB);
        if (boxA && boxB) {
            let best: { c: typeof ftthCables[number]; score: number } | null = null;
            for (const c of ftthCables) {
                if (consumed.has(c.id)) continue;
                if (c.fiberCount !== oc.fiberCount) continue;
                const { first, last } = getCableEndpoints(c);
                if (!first || !last) continue;
                // par ordenado a→b ou b→a
                const d1 = distanceMeters(boxA.lat, boxA.lng, first.lat, first.lng)
                    + distanceMeters(boxB.lat, boxB.lng, last.lat, last.lng);
                const d2 = distanceMeters(boxA.lat, boxA.lng, last.lat, last.lng)
                    + distanceMeters(boxB.lat, boxB.lng, first.lat, first.lng);
                const score = Math.min(d1, d2);
                if (score < 60 && (!best || score < best.score)) best = { c, score };
            }
            if (best) {
                consumed.add(best.c.id);
                cableIdToFtthCableId.set(oc.id, best.c.id);
                cableMatchReason.set(oc.id, `coords(${Math.round(best.score)}m)`);
                return;
            }
        }
        unmappedCables++;
        unmappedCablesList.push(oc);
    });

    // Stats por estratégia
    const reasonCount: Record<string, number> = {};
    cableMatchReason.forEach(r => {
        const key = r.startsWith('coords') ? 'coords' : r;
        reasonCount[key] = (reasonCount[key] || 0) + 1;
    });
    console.log(`[FusionImport] Cabos mapeados: ${cableIdToFtthCableId.size}, não mapeados: ${unmappedCables}`);
    Object.entries(reasonCount).forEach(([k, v]) => console.log(`    - via ${k}: ${v}`));
    if (filterName && unmappedCablesList.length > 0) {
        console.log('  Não mapeados (modo debug):');
        unmappedCablesList.forEach(c => {
            const a = ozBoxById.get(c.boxA);
            const b = ozBoxById.get(c.boxB);
            console.log(`    - ${c.name || '(sem nome)'} ${c.fiberCount}FO  ${a?.name || '?'} → ${b?.name || '?'}`);
        });
    }

    // -------------------------------------------------------------------------
    // 5. Lookup pra resolver connectables OZMap → FTTH port IDs
    // -------------------------------------------------------------------------
    // ozFiberId → FTTH `${ftthCableId}-fiber-${N-1}` (FTTH é 0-indexed!)
    const fiberToPortId = new Map<string, string>();
    ozFibers.forEach(f => {
        const ftthCableId = cableIdToFtthCableId.get(f.cableId);
        if (!ftthCableId) return; // fibra de cabo não mapeado
        // OZMap usa fiber_number 1-indexed; FTTH Planner usa 0-indexed
        // (`${cableId}-fiber-0` é a fibra 1 do cabo). Sem o -1, conexões caem
        // em IDs inexistentes (ex: fiber-12 num cabo 12FO) e o editor não
        // renderiza.
        fiberToPortId.set(f.id, `${ftthCableId}-fiber-${f.fiberNumber - 1}`);
    });

    // splitter input connectable → ozSplitterId
    const inputConnectableToSplitter = new Map<string, string>();
    ozSplitters.forEach(s => {
        if (s.input) inputConnectableToSplitter.set(s.input, s.id);
    });

    // splitter output connectable → (ozSplitterId, portIdx)
    const outputConnectableToPort = new Map<string, { splitterId: string; portIndex: number }>();
    ozSplitterOutputs.forEach(o => {
        if (o.connectable) outputConnectableToPort.set(o.connectable, { splitterId: o.splitterId, portIndex: o.portIndex });
    });

    function resolveConnectable(ozId: string | null): string | null {
        if (!ozId) return null;
        const fiber = fiberToPortId.get(ozId);
        if (fiber) return fiber;
        const splIn = inputConnectableToSplitter.get(ozId);
        if (splIn) return `${splIn}-in`;
        const splOut = outputConnectableToPort.get(ozId);
        if (splOut) return `${splOut.splitterId}-out-${splOut.portIndex}`;
        return null;
    }

    // -------------------------------------------------------------------------
    // 6. Constrói payload por CTO (splitters + connections)
    // -------------------------------------------------------------------------
    interface FtthSplitter { id: string; name: string; type: string; inputPortId: string; outputPortIds: string[]; }
    interface FtthConnection { id: string; sourceId: string; targetId: string; color: string; }
    interface FtthFusionPoint { id: string; name: string; type?: 'generic' | 'tray'; category?: 'fusion' | 'connector'; }
    interface CtoPayload { splitters: FtthSplitter[]; connections: FtthConnection[]; fusions: FtthFusionPoint[]; }
    const payloadByFtthCtoId = new Map<string, CtoPayload>();

    function getPayload(ftthCtoId: string): CtoPayload {
        let p = payloadByFtthCtoId.get(ftthCtoId);
        if (!p) { p = { splitters: [], connections: [], fusions: [] }; payloadByFtthCtoId.set(ftthCtoId, p); }
        return p;
    }

    // Quando em modo debug (--cto), restringe o boxIdToFtthCtoId pra incluir
    // só a CTO alvo — splitters/fusions de outras CTOs ficam ignorados.
    let targetFtthCtoId: string | null = null;
    if (filterName) {
        const targetOzBox = ozBoxes.find(b => b.name.trim().toUpperCase() === filterName);
        if (!targetOzBox) {
            console.error(`[FusionImport] CTO "${filterName}" não achada nos dados OZMap.`);
            process.exit(1);
        }
        targetFtthCtoId = boxIdToFtthCtoId.get(targetOzBox.id) || null;
        if (!targetFtthCtoId) {
            console.error(`[FusionImport] CTO "${filterName}" achada no OZMap mas sem par no FTTH.`);
            process.exit(1);
        }
        console.log(`[FusionImport] Alvo: ozBox=${targetOzBox.id} → ftthCto=${targetFtthCtoId}`);
        // Limpa o mapa pra deixar só essa entrada
        const onlyThis = new Map<string, string>();
        onlyThis.set(targetOzBox.id, targetFtthCtoId);
        boxIdToFtthCtoId.clear();
        boxIdToFtthCtoId.set(targetOzBox.id, targetFtthCtoId);
    }

    // Splitters
    let splittersImported = 0, splittersSkipped = 0;
    ozSplitters.forEach(s => {
        const ftthCtoId = boxIdToFtthCtoId.get(s.boxId);
        if (!ftthCtoId) { splittersSkipped++; return; }
        const outputPortIds: string[] = [];
        for (let i = 0; i < s.ratioOut; i++) outputPortIds.push(`${s.id}-out-${i}`);
        const p = getPayload(ftthCtoId);
        p.splitters.push({
            id: s.id,
            name: `${p.splitters.length + 1}`,
            type: `${s.ratioIn}x${s.ratioOut}`,
            inputPortId: `${s.id}-in`,
            outputPortIds,
        });
        splittersImported++;
    });

    // Fusões fibra↔fibra (ou fibra↔splitter)
    // Cada oz_fusion vira 1 FusionPoint (bandeja visual) + 2 connections
    // (fibra → fusion-a, fusion-b → fibra). Sem o FusionPoint o editor mostra
    // só a linha direta sem o nó intermediário — válido funcionalmente mas
    // perde a representação visual de splice/bandeja.
    let fusionsImported = 0, fusionsSkipped = 0;
    const fusionFailures: { f: OzFusion; reason: string }[] = [];
    ozFusions.forEach(f => {
        const ftthCtoId = boxIdToFtthCtoId.get(f.boxId);
        if (!ftthCtoId) { fusionsSkipped++; return; }
        const a = resolveConnectable(f.a);
        const b = resolveConnectable(f.b);
        if (!a || !b) {
            fusionsSkipped++;
            if (filterName) fusionFailures.push({ f, reason: `a=${a ? 'ok' : 'FAIL ' + f.a} b=${b ? 'ok' : 'FAIL ' + f.b}` });
            return;
        }
        const p = getPayload(ftthCtoId);
        // Bandeja visual
        p.fusions.push({
            id: f.id,
            name: `F${p.fusions.length + 1}`,
            type: 'generic',
            category: 'fusion',
        });
        // 2 conexões através do FusionPoint (portas -a e -b)
        p.connections.push({
            id: `${f.id}-a`, sourceId: a, targetId: `${f.id}-a`, color: '#10b981',
        });
        p.connections.push({
            id: `${f.id}-b`, sourceId: `${f.id}-b`, targetId: b, color: '#10b981',
        });
        fusionsImported++;
    });
    if (filterName && fusionFailures.length > 0) {
        console.log(`[FusionImport] Fusões com connectable não resolvido (modo debug):`);
        fusionFailures.slice(0, 20).forEach(({ f, reason }) => {
            console.log(`    - fusion ${f.id}: ${reason}`);
        });
    }

    // Saídas diretas splitter→fibra (sem fusion intermediária)
    let directOutputsImported = 0;
    ozSplitterOutputs.forEach(o => {
        if (!o.connectable) return;
        const splitter = ozSplitters.find(s => s.id === o.splitterId);
        if (!splitter) return;
        const ftthCtoId = boxIdToFtthCtoId.get(splitter.boxId);
        if (!ftthCtoId) return;
        const target = resolveConnectable(o.connectable);
        if (!target) return;
        const sourceId = `${o.splitterId}-out-${o.portIndex}`;
        const p = getPayload(ftthCtoId);
        const exists = p.connections.some(c =>
            (c.sourceId === sourceId && c.targetId === target) ||
            (c.sourceId === target && c.targetId === sourceId)
        );
        if (exists) return;
        p.connections.push({
            id: `splitter-out-${o.splitterId}-${o.portIndex}`,
            sourceId, targetId: target, color: '#10b981',
        });
        directOutputsImported++;
    });

    // -------------------------------------------------------------------------
    // 6.5. Pass-through automático
    //
    // OZMap só documenta as fusões da "sangria" (fibras drenadas pro splitter
    // ou cabo lateral). As outras fibras passam direto pela CTO entre o cabo
    // de entrada e o de saída — passagem implícita. FTTH Planner não tem esse
    // conceito implícito, então preciso adicionar essas fusões explicitamente.
    //
    // Heurística: cabos que diferem só no último -A/-B do nome E têm mesmo
    // fiberCount são par de passagem. Pra cada fibra livre (não usada pelas
    // fusões/splitters anteriores), cria bandeja + 2 conexões pass-through.
    // -------------------------------------------------------------------------
    function stripPairSuffix(name: string): { base: string; suffix: 'A' | 'B' | null } {
        const m = /^(.*?)-([AB])$/.exec(name.trim());
        if (m) return { base: m[1], suffix: m[2] as 'A' | 'B' };
        return { base: name, suffix: null };
    }

    // Indexa fibras já consumidas (cableId:fiberIdx) pelas fusões/splitters anteriores
    const usedFibers = new Set<string>();
    payloadByFtthCtoId.forEach(p => {
        p.connections.forEach(c => {
            [c.sourceId, c.targetId].forEach(portId => {
                const mm = /^(.+)-fiber-(\d+)$/.exec(portId);
                if (mm) usedFibers.add(`${mm[1]}:${mm[2]}`);
            });
        });
    });

    // Lista cabos por OZMap box (qualquer ponta)
    const cablesByBox = new Map<string, OzCable[]>();
    ozCables.forEach(c => {
        if (!cablesByBox.has(c.boxA)) cablesByBox.set(c.boxA, []);
        cablesByBox.get(c.boxA)!.push(c);
        if (!cablesByBox.has(c.boxB)) cablesByBox.set(c.boxB, []);
        cablesByBox.get(c.boxB)!.push(c);
    });

    let passthroughAdded = 0, passthroughPairs = 0;
    Array.from(boxIdToFtthCtoId.entries()).forEach(([ozBoxId, ftthCtoId]) => {
        const cables = cablesByBox.get(ozBoxId) || [];
        // Agrupa cabos por base name + fiberCount
        const groups = new Map<string, OzCable[]>();
        cables.forEach(c => {
            const { base, suffix } = stripPairSuffix(c.name);
            if (!suffix) return; // só cabos com -A/-B no final entram
            const k = `${base}|${c.fiberCount}`;
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k)!.push(c);
        });

        groups.forEach(pair => {
            if (pair.length !== 2) return;
            const s0 = stripPairSuffix(pair[0].name).suffix;
            const s1 = stripPairSuffix(pair[1].name).suffix;
            if (s0 === s1) return; // ambos -A ou ambos -B, não é par real

            const ftthA = cableIdToFtthCableId.get(pair[0].id);
            const ftthB = cableIdToFtthCableId.get(pair[1].id);
            if (!ftthA || !ftthB) return;

            const p = getPayload(ftthCtoId);
            let pairAdded = 0;
            for (let i = 0; i < pair[0].fiberCount; i++) {
                if (usedFibers.has(`${ftthA}:${i}`)) continue;
                if (usedFibers.has(`${ftthB}:${i}`)) continue;
                // Pass-through = continuidade lógica, SEM bandeja visual.
                // Só uma conexão direta fibra→fibra.
                const portA = `${ftthA}-fiber-${i}`;
                const portB = `${ftthB}-fiber-${i}`;
                p.connections.push({
                    id: `pt-${pair[0].id}-${pair[1].id}-${i}`,
                    sourceId: portA,
                    targetId: portB,
                    color: '#10b981',
                });
                usedFibers.add(`${ftthA}:${i}`);
                usedFibers.add(`${ftthB}:${i}`);
                passthroughAdded++;
                pairAdded++;
            }
            if (pairAdded > 0) passthroughPairs++;
        });
    });

    console.log(`[FusionImport] Pass-through: ${passthroughAdded} fusões adicionadas em ${passthroughPairs} pares de cabos`);

    // -------------------------------------------------------------------------
    // 7. Update no banco
    // -------------------------------------------------------------------------
    console.log(`[FusionImport] Atualizando ${payloadByFtthCtoId.size} CTOs...`);
    for (const ftthCtoId of Array.from(payloadByFtthCtoId.keys())) {
        const payload = payloadByFtthCtoId.get(ftthCtoId)!;
        await prisma.cto.update({
            where: { id: ftthCtoId },
            data: {
                splitters: payload.splitters as any,
                connections: payload.connections as any,
                fusions: payload.fusions as any,
            },
        });
    }

    console.log('[FusionImport] ✓ Concluído.');
    console.log(`  - CTOs atualizados:  ${payloadByFtthCtoId.size}`);
    console.log(`  - Splitters:         ${splittersImported} (${splittersSkipped} sem CTO mapeado)`);
    console.log(`  - Fusões:            ${fusionsImported} (${fusionsSkipped} sem CTO/connectable mapeado)`);
    console.log(`  - Saídas diretas:    ${directOutputsImported}`);
    console.log(`  - Pass-through:      ${passthroughAdded} (${passthroughPairs} pares de cabos)`);
    if (unmappedBoxes.length > 0 || unmappedCables > 0) {
        console.log(`  ⚠  Mapeamento incompleto: ${unmappedBoxes.length} CTOs e ${unmappedCables} cabos OZMap não acharam par no projeto FTTH.`);
        console.log('     Causa provável: nomes diferentes ou cabos ainda não importados. Renomeie pelos nomes do OZMap (ex: NPXA-AA-0102) e rode de novo.');
    }
}

main()
    .catch(e => { console.error('[FusionImport] ERRO:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
