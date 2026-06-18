/**
 * Importa um dump SQL do OZMap pra um projeto FTTH Planner existente.
 *
 * Mapeamento:
 *   oz_box (level 2 = CEO, level 3 = CTO)  →  ctos[]   (type: CEO|CTO)
 *   oz_cable                                →  cables[]  (coords = linha reta A→B)
 *   oz_splitter                             →  ctos.splitters[]  (JSON inline)
 *   oz_fusion                               →  ctos.connections[] (JSON inline)
 *   oz_splitter_output (com connectable_id) →  ctos.connections[] (port→fibra)
 *
 * Limitações conhecidas:
 *   - Cabos de drop (cable_type 5d83b2fc...) viram cables normais de 1 fibra,
 *     NÃO drops[] separados. Migração de drops fica pra v2.
 *   - Coordenadas = linha reta entre box_a e box_b. Sem o traçado original.
 *   - Postes referenciados via box.pole ficam ignorados (sem oz_pole no dump).
 *   - Catálogo: catalogId = null em tudo (IDs OZMap não batem com seu catálogo).
 *   - implanted=1 → status DEPLOYED/ACTIVE, implanted=0 → NOT_DEPLOYED/PLANNED.
 *
 * Convenções de port ID do FTTH Planner (espelhadas aqui):
 *   - Fibra de cabo:        `${cableId}-fiber-${N}` (N 1-indexed)
 *   - Splitter input:       `${splitterId}-in`
 *   - Splitter output port: `${splitterId}-out-${portIndex}` (port 0-indexed)
 *
 * Rodar:
 *   cd server
 *   npx ts-node scripts/import-ozmap.ts <sqlFilePath> <projectId>
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// -----------------------------------------------------------------------------
// Parser de SQL MySQL → estruturas em memória
// -----------------------------------------------------------------------------

type Row = (string | number | null)[];

/**
 * Tokeniza uma "tupla" — string entre parênteses de um VALUES (...).
 * Trata strings quoted com escape \', escape \\, NULL literal, e números.
 */
function parseTuple(s: string): Row {
    const out: Row = [];
    let i = 0;
    const n = s.length;

    while (i < n) {
        // skip whitespace
        while (i < n && /\s/.test(s[i])) i++;
        if (i >= n) break;

        if (s[i] === "'") {
            // string literal
            i++; // open quote
            let val = '';
            while (i < n) {
                if (s[i] === '\\' && i + 1 < n) {
                    val += s[i + 1];
                    i += 2;
                } else if (s[i] === "'") {
                    if (i + 1 < n && s[i + 1] === "'") {
                        val += "'";
                        i += 2;
                    } else {
                        break;
                    }
                } else {
                    val += s[i];
                    i++;
                }
            }
            i++; // close quote
            out.push(val);
        } else if (s.substr(i, 4).toUpperCase() === 'NULL') {
            out.push(null);
            i += 4;
        } else {
            // number / unquoted
            let val = '';
            while (i < n && s[i] !== ',' && s[i] !== ')') {
                val += s[i];
                i++;
            }
            val = val.trim();
            if (val === '') {
                out.push(null);
            } else {
                const num = Number(val);
                out.push(isNaN(num) ? val : num);
            }
        }

        // skip separator
        while (i < n && (s[i] === ',' || /\s/.test(s[i]))) i++;
    }

    return out;
}

/**
 * Extrai todas as tuplas de um INSERT — varre caractere a caractere
 * respeitando strings entre aspas (pra não quebrar em vírgulas internas).
 */
function extractTuples(valuesBlock: string): string[] {
    const tuples: string[] = [];
    let depth = 0;
    let inString = false;
    let escape = false;
    let start = -1;

    for (let i = 0; i < valuesBlock.length; i++) {
        const c = valuesBlock[i];

        if (escape) { escape = false; continue; }
        if (inString) {
            if (c === '\\') { escape = true; continue; }
            if (c === "'") {
                if (i + 1 < valuesBlock.length && valuesBlock[i + 1] === "'") {
                    i++; // doubled quote stays in string
                    continue;
                }
                inString = false;
            }
            continue;
        }
        if (c === "'") { inString = true; continue; }
        if (c === '(') {
            if (depth === 0) start = i + 1;
            depth++;
        } else if (c === ')') {
            depth--;
            if (depth === 0 && start >= 0) {
                tuples.push(valuesBlock.slice(start, i));
                start = -1;
            }
        }
    }

    return tuples;
}

/**
 * Faz parse de todo o conteúdo do dump e retorna {tableName: Row[]} por tabela.
 * Aceita múltiplos INSERTs por tabela (chunked).
 */
function parseDump(sql: string): Record<string, Row[]> {
    const result: Record<string, Row[]> = {};
    const insertRe = /INSERT\s+INTO\s+`(\w+)`\s*\([^)]+\)\s*VALUES\s*([\s\S]*?);/gi;
    let m: RegExpExecArray | null;

    while ((m = insertRe.exec(sql)) !== null) {
        const table = m[1];
        const valuesBlock = m[2];
        const tuples = extractTuples(valuesBlock);
        const rows = tuples.map(parseTuple);

        if (!result[table]) result[table] = [];
        result[table].push(...rows);
    }

    return result;
}

// -----------------------------------------------------------------------------
// Domain types
// -----------------------------------------------------------------------------

interface OzBox {
    id: string;
    name: string;
    hierarchyLevel: number;
    lat: number;
    lng: number;
    implanted: boolean;
}

interface OzCable {
    id: string;
    name: string;
    boxA: string;
    boxB: string;
    fiberCount: number;
    looseCount: number;
    length: number; // km no OZMap
    implanted: boolean;
}

interface OzFiber {
    id: string;
    cableId: string;
    fiberNumber: number;
}

interface OzFusion {
    id: string;
    boxId: string;
    connectableA: string | null;
    connectableB: string | null;
}

interface OzSplitter {
    id: string;
    boxId: string;
    ratioIn: number;
    ratioOut: number;
    inputConnectable: string | null;
}

interface OzSplitterOutput {
    splitterId: string;
    portIndex: number;
    connectableId: string | null;
}

interface OzPole {
    id: string;
    lat: number;
    lng: number;
}

interface OzCablePole {
    cableId: string;
    seq: number;
    poleId: string;
}

interface OzBoxDesign {
    id: string;
    box: string;
    positions: any; // JSON parseado: { fusions: {id: {x,y}}, splitters: ..., cables: ... }
}

// -----------------------------------------------------------------------------
// FTTH Planner output structures (snapshot do schema atual)
// -----------------------------------------------------------------------------

interface FtthSplitter {
    id: string;
    name: string;
    type: string;
    inputPortId: string;
    outputPortIds: string[];
    catalogId?: string;
}

interface FtthConnection {
    id: string;
    sourceId: string;
    targetId: string;
    color: string;
}

interface FtthFusionPoint {
    id: string;
    name: string;
    type?: 'generic' | 'tray';
    category?: 'fusion' | 'connector';
}

interface FtthCto {
    id: string;
    projectId: string;
    name: string;
    type: 'CTO' | 'CEO';
    status: 'DEPLOYED' | 'PLANNED';
    lat: number;
    lng: number;
    splitters: FtthSplitter[];
    fusions: FtthFusionPoint[]; // Bandejas — 1 por fusão explícita do OZMap
    connections: FtthConnection[];
    inputCableIds: string[];
    clientCount: number;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
    const [, , sqlPath, projectId] = process.argv;

    if (!sqlPath || !projectId) {
        console.error('Uso: ts-node import-ozmap.ts <sqlFilePath> <projectId>');
        process.exit(1);
    }

    const absSqlPath = path.resolve(sqlPath);
    if (!fs.existsSync(absSqlPath)) {
        console.error(`Arquivo não encontrado: ${absSqlPath}`);
        process.exit(1);
    }

    // Confirma projeto
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
        console.error(`Projeto não encontrado: ${projectId}`);
        process.exit(1);
    }
    console.log(`[Import] Projeto destino: ${project.name} (${projectId})`);

    // -------------------------------------------------------------------------
    // 1. Parse SQL
    // -------------------------------------------------------------------------
    console.log('[Import] Lendo SQL...');
    const sql = fs.readFileSync(absSqlPath, 'utf-8');
    const tables = parseDump(sql);

    const boxes: OzBox[] = (tables.oz_box || []).map(r => ({
        id: r[0] as string,
        name: r[1] as string,
        hierarchyLevel: r[3] as number,
        lat: r[7] as number,
        lng: r[8] as number,
        implanted: r[11] === 1,
    }));

    const cables: OzCable[] = (tables.oz_cable || []).map(r => ({
        id: r[0] as string,
        name: (r[1] as string) || '',
        boxA: r[3] as string,
        boxB: r[4] as string,
        fiberCount: r[5] as number,
        looseCount: r[6] as number,
        length: r[7] as number,
        implanted: r[10] === 1,
    }));

    const fibers: OzFiber[] = (tables.oz_fiber || []).map(r => ({
        id: r[0] as string,
        fiberNumber: r[2] as number,
        cableId: r[3] as string,
    }));

    const fusions: OzFusion[] = (tables.oz_fusion || []).map(r => ({
        id: r[0] as string,
        boxId: r[2] as string,
        connectableA: r[3] as string | null,
        connectableB: r[4] as string | null,
    }));

    const splitters: OzSplitter[] = (tables.oz_splitter || []).map(r => ({
        id: r[0] as string,
        boxId: r[2] as string,
        ratioIn: r[4] as number,
        ratioOut: r[5] as number,
        inputConnectable: r[7] as string | null,
    }));

    const poles: OzPole[] = (tables.oz_pole || []).map(r => ({
        id: r[0] as string,
        // schema oz_pole: id, name, lat, lng, project, created_at, updated_at
        lat: r[2] as number,
        lng: r[3] as number,
    }));

    const cablePoles: OzCablePole[] = (tables.oz_cable_pole || []).map(r => ({
        cableId: r[0] as string,
        seq: r[1] as number,
        poleId: r[2] as string,
    }));

    let designsParsed = 0, designsBadJson = 0, designsNoPositions = 0;
    const boxDesigns: OzBoxDesign[] = (tables.oz_box_design || []).map(r => {
        // schema: id, box, project, positions, topology, is_template, template, created_at, updated_at
        const rawPositions = r[3] as string | null;
        let positions: any = null;
        if (rawPositions === null || rawPositions === undefined) {
            designsNoPositions++;
        } else if (typeof rawPositions === 'string') {
            try {
                positions = JSON.parse(rawPositions);
                designsParsed++;
            } catch (e) {
                designsBadJson++;
                if (designsBadJson <= 3) {
                    console.log(`[Import] JSON parse FAIL no box ${r[1]}: ${(e as Error).message.slice(0, 80)} | sample: ${rawPositions.slice(0, 100)}`);
                }
            }
        }
        return {
            id: r[0] as string,
            box: r[1] as string,
            positions,
        };
    });
    console.log(`[Import] BoxDesigns: ${boxDesigns.length} total | ${designsParsed} parseados ok | ${designsBadJson} JSON inválido | ${designsNoPositions} sem positions`);

    const splitterOutputs: OzSplitterOutput[] = (tables.oz_splitter_output || []).map(r => ({
        splitterId: r[0] as string,
        portIndex: r[1] as number,
        connectableId: r[2] as string | null,
    }));

    console.log(`[Import] Parseado: ${boxes.length} boxes, ${cables.length} cabos, ${fibers.length} fibras, ${fusions.length} fusões, ${splitters.length} splitters, ${splitterOutputs.length} portas de splitter, ${poles.length} postes, ${cablePoles.length} cable-pole links, ${boxDesigns.length} designs`);

    // -------------------------------------------------------------------------
    // 2. Lookup tables
    // -------------------------------------------------------------------------
    const boxById = new Map<string, OzBox>();
    boxes.forEach(b => boxById.set(b.id, b));

    // ozFiberId → FTTH Planner port ID (FTTH é 0-indexed; OZMap é 1-indexed)
    const fiberToPortId = new Map<string, string>();
    fibers.forEach(f => {
        fiberToPortId.set(f.id, `${f.cableId}-fiber-${f.fiberNumber - 1}`);
    });

    // splitter input connectable → splitterId
    const inputConnectableToSplitter = new Map<string, string>();
    splitters.forEach(s => {
        if (s.inputConnectable) inputConnectableToSplitter.set(s.inputConnectable, s.id);
    });

    // splitter output connectable → (splitterId, portIndex)
    const outputConnectableToPort = new Map<string, { splitterId: string; portIndex: number }>();
    splitterOutputs.forEach(o => {
        if (o.connectableId) {
            outputConnectableToPort.set(o.connectableId, { splitterId: o.splitterId, portIndex: o.portIndex });
        }
    });

    /**
     * Resolve um OZMap connectable ID pro port ID do FTTH Planner.
     * Retorna null se não conseguir mapear (ID órfão / equipamento não suportado).
     */
    function resolveConnectable(ozId: string | null): string | null {
        if (!ozId) return null;
        const fiber = fiberToPortId.get(ozId);
        if (fiber) return fiber;
        const splitterInput = inputConnectableToSplitter.get(ozId);
        if (splitterInput) return `${splitterInput}-in`;
        const splitterOutput = outputConnectableToPort.get(ozId);
        if (splitterOutput) return `${splitterOutput.splitterId}-out-${splitterOutput.portIndex}`;
        return null;
    }

    // -------------------------------------------------------------------------
    // 3. Constrói CTOs com splitters + connections agregados
    // -------------------------------------------------------------------------
    const ctosById = new Map<string, FtthCto>();

    boxes.forEach(b => {
        if (b.hierarchyLevel !== 2 && b.hierarchyLevel !== 3) {
            // POPs (level 1) ficam de fora dessa migração — não tem nenhum nesse dump.
            return;
        }
        ctosById.set(b.id, {
            id: b.id,
            projectId,
            name: b.name,
            type: b.hierarchyLevel === 2 ? 'CEO' : 'CTO',
            status: b.implanted ? 'DEPLOYED' : 'PLANNED',
            lat: b.lat,
            lng: b.lng,
            splitters: [],
            fusions: [],
            connections: [],
            inputCableIds: [],
            clientCount: 0,
        });
    });

    // Splitters → adiciona no CTO correspondente
    let splittersImported = 0;
    splitters.forEach(s => {
        const cto = ctosById.get(s.boxId);
        if (!cto) return;
        const outputPortIds: string[] = [];
        for (let i = 0; i < s.ratioOut; i++) outputPortIds.push(`${s.id}-out-${i}`);
        cto.splitters.push({
            id: s.id,
            name: `${cto.splitters.length + 1}`,
            type: `${s.ratioIn}x${s.ratioOut}`,
            inputPortId: `${s.id}-in`,
            outputPortIds,
        });
        splittersImported++;
    });

    // Fusões → 1 bandeja (FusionPoint) + 2 conexões através das portas -a e -b
    // Sem o FusionPoint o editor mostra só linha direta sem nó intermediário.
    let fusionsImported = 0;
    let fusionsSkipped = 0;
    fusions.forEach(f => {
        const cto = ctosById.get(f.boxId);
        if (!cto) { fusionsSkipped++; return; }
        const a = resolveConnectable(f.connectableA);
        const b = resolveConnectable(f.connectableB);
        if (!a || !b) { fusionsSkipped++; return; }
        cto.fusions.push({
            id: f.id,
            name: `F${cto.fusions.length + 1}`,
            type: 'generic',
            category: 'fusion',
        });
        cto.connections.push({
            id: `${f.id}-a`, sourceId: a, targetId: `${f.id}-a`, color: '#10b981',
        });
        cto.connections.push({
            id: `${f.id}-b`, sourceId: `${f.id}-b`, targetId: b, color: '#10b981',
        });
        fusionsImported++;
    });

    // Splitter outputs com connectable_id → conexão direta splitter port → fibra
    let directOutputsImported = 0;
    splitterOutputs.forEach(o => {
        if (!o.connectableId) return;
        // Acha o CTO via splitter.boxId
        const splitter = splitters.find(s => s.id === o.splitterId);
        if (!splitter) return;
        const cto = ctosById.get(splitter.boxId);
        if (!cto) return;
        const target = resolveConnectable(o.connectableId);
        if (!target) return;
        // Se o connectable_id já é uma fibra de cabo de drop, cria conexão.
        // Pra evitar duplicar (fusão também pode estar mapeando), só cria se
        // ainda não tem connection com esses 2 endpoints.
        const sourceId = `${o.splitterId}-out-${o.portIndex}`;
        const exists = cto.connections.some(c =>
            (c.sourceId === sourceId && c.targetId === target) ||
            (c.sourceId === target && c.targetId === sourceId)
        );
        if (exists) return;
        cto.connections.push({
            id: `splitter-out-${o.splitterId}-${o.portIndex}`,
            sourceId,
            targetId: target,
            color: '#10b981',
        });
        directOutputsImported++;
    });

    // -------------------------------------------------------------------------
    // 3.5. Pass-through automático entre cabos -A/-B do mesmo tronco
    //
    // OZMap só documenta fusão na sangria. Fibras que continuam direto pelo
    // tronco (TRONCO 1-...-A → TRONCO 1-...-B) ficam como passagem implícita.
    // FTTH precisa de conexão explícita pra essas — sem bandeja (continuidade
    // lógica, não splice).
    // -------------------------------------------------------------------------
    function stripPairSuffix(name: string): { base: string; suffix: 'A' | 'B' | null } {
        const m = /^(.*?)-([AB])$/.exec((name || '').trim());
        if (m) return { base: m[1], suffix: m[2] as 'A' | 'B' };
        return { base: name, suffix: null };
    }

    // Indexa fibras já consumidas pelas fusões/splitters anteriores
    const usedFibers = new Set<string>();
    ctosById.forEach(cto => {
        cto.connections.forEach(c => {
            [c.sourceId, c.targetId].forEach(portId => {
                const mm = /^(.+)-fiber-(\d+)$/.exec(portId);
                if (mm) usedFibers.add(`${mm[1]}:${mm[2]}`);
            });
        });
    });

    // Lista cabos por OZMap box (qualquer ponta)
    const cablesByBox = new Map<string, OzCable[]>();
    cables.forEach(c => {
        if (!cablesByBox.has(c.boxA)) cablesByBox.set(c.boxA, []);
        cablesByBox.get(c.boxA)!.push(c);
        if (!cablesByBox.has(c.boxB)) cablesByBox.set(c.boxB, []);
        cablesByBox.get(c.boxB)!.push(c);
    });

    let passthroughAdded = 0, passthroughPairs = 0;
    Array.from(ctosById.entries()).forEach(([ozBoxId, cto]) => {
        const boxCables = cablesByBox.get(ozBoxId) || [];
        const groups = new Map<string, OzCable[]>();
        boxCables.forEach(c => {
            const { base, suffix } = stripPairSuffix(c.name);
            if (!suffix) return;
            const k = `${base}|${c.fiberCount}`;
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k)!.push(c);
        });
        groups.forEach(pair => {
            if (pair.length !== 2) return;
            const s0 = stripPairSuffix(pair[0].name).suffix;
            const s1 = stripPairSuffix(pair[1].name).suffix;
            if (s0 === s1) return;
            // No full import, cable IDs no FTTH são os mesmos do OZMap
            let pairAdded = 0;
            for (let i = 0; i < pair[0].fiberCount; i++) {
                if (usedFibers.has(`${pair[0].id}:${i}`)) continue;
                if (usedFibers.has(`${pair[1].id}:${i}`)) continue;
                cto.connections.push({
                    id: `pt-${pair[0].id}-${pair[1].id}-${i}`,
                    sourceId: `${pair[0].id}-fiber-${i}`,
                    targetId: `${pair[1].id}-fiber-${i}`,
                    color: '#10b981',
                });
                usedFibers.add(`${pair[0].id}:${i}`);
                usedFibers.add(`${pair[1].id}:${i}`);
                passthroughAdded++;
                pairAdded++;
            }
            if (pairAdded > 0) passthroughPairs++;
        });
    });

    // -------------------------------------------------------------------------
    // 4. Constrói cabos (linha reta entre box_a e box_b)
    // -------------------------------------------------------------------------
    interface FtthCable {
        id: string;
        projectId: string;
        name: string;
        status: string;
        fiberCount: number;
        looseTubeCount: number;
        coordinates: { lat: number; lng: number }[];
        fromNodeId: string | null;
        toNodeId: string | null;
        technicalReserve: number;
    }

    // Índices pra reconstruir traçado do cabo via postes
    const poleById = new Map<string, OzPole>();
    poles.forEach(p => poleById.set(p.id, p));

    const polesByCable = new Map<string, OzCablePole[]>();
    cablePoles.forEach(cp => {
        if (!polesByCable.has(cp.cableId)) polesByCable.set(cp.cableId, []);
        polesByCable.get(cp.cableId)!.push(cp);
    });
    polesByCable.forEach(arr => arr.sort((x, y) => x.seq - y.seq));

    const cablesOut: FtthCable[] = [];
    let cablesSkipped = 0;
    let cablesWithRealPath = 0;

    cables.forEach(c => {
        const a = boxById.get(c.boxA);
        const b = boxById.get(c.boxB);
        if (!a || !b) {
            // Cabo com endpoint fora do oz_box (drop terminando em ponto solto)
            cablesSkipped++;
            return;
        }
        // Monta coordinates: boxA → pole_seq_0 → pole_seq_1 → ... → boxB
        const coords: { lat: number; lng: number }[] = [{ lat: a.lat, lng: a.lng }];
        const cablePolesArr = polesByCable.get(c.id) || [];
        for (const cp of cablePolesArr) {
            const pole = poleById.get(cp.poleId);
            if (!pole || pole.lat == null || pole.lng == null) continue;
            coords.push({ lat: pole.lat, lng: pole.lng });
        }
        coords.push({ lat: b.lat, lng: b.lng });
        if (cablePolesArr.length > 0) cablesWithRealPath++;

        cablesOut.push({
            id: c.id,
            projectId,
            name: c.name || `Cabo ${c.fiberCount}FO`,
            status: c.implanted ? 'DEPLOYED' : 'NOT_DEPLOYED',
            fiberCount: c.fiberCount,
            looseTubeCount: c.looseCount,
            coordinates: coords,
            fromNodeId: c.boxA,
            toNodeId: c.boxB,
            technicalReserve: 0,
        });

        // inputCableIds nos CTOs de destino (toNodeId)
        const ctoTo = ctosById.get(c.boxB);
        if (ctoTo && !ctoTo.inputCableIds.includes(c.id)) {
            ctoTo.inputCableIds.push(c.id);
        }
    });

    console.log(`[Import] Transformado: ${ctosById.size} CTOs/CEOs, ${cablesOut.length} cabos (${cablesSkipped} skipped — endpoint fora do oz_box), ${splittersImported} splitters, ${fusionsImported} fusões (${fusionsSkipped} skipped), ${directOutputsImported} conexões diretas splitter→fibra`);

    // -------------------------------------------------------------------------
    // 5. Limpa CTOs+cabos existentes do projeto (idempotência) e insere
    // -------------------------------------------------------------------------
    console.log('[Import] Limpando dados existentes do projeto...');
    await prisma.$transaction([
        prisma.cable.deleteMany({ where: { projectId } }),
        prisma.cto.deleteMany({ where: { projectId } }),
        prisma.pop.deleteMany({ where: { projectId } }),
    ]);

    // BoxDesign → layout do diagrama de fusão.
    // Estrutura do positions (OZMap):
    //   {
    //     fusions:   {<id>: {x, y}},   ← simples
    //     splitters: {<id>: {x, y}},   ← simples
    //     cables:    {<id>: {x, y}},   ← simples
    //     drops:     {<id>: {x, y}},   ← simples
    //     fibers:    {<id>: {vertices: [], labels}}, ← path, ignora
    //     cords:     {<id>: {vertices: [], labels}}, ← path, ignora
    //     passings:  {<id>: {vertices: [], labels}}, ← path, ignora
    //     postits:   [{x, y, config: {id, text,...}}], ← array, mapeia via config.id
    //     children:  [], ← vazio
    //   }
    // FTTH usa Record<elementId, {x, y, rotation}>.
    // Auto-layout estilo OZMap (ignora BoxDesign do OZMap — sistema de coords
    // não bate 1:1 com FTTH). Disposição padrão:
    //   - Coluna esquerda (x=0):     cabos (input + output + distribuição)
    //   - Coluna meio   (x=400):     bandejas de fusão
    //   - Coluna direita (x=700):    splitters
    //   - Drops/saídas embaixo dos splitters
    const COL_CABLE_X = 0;
    const COL_FUSION_X = 400;
    const COL_SPLITTER_X = 700;
    const CABLE_GAP = 40;
    const FUSION_GAP = 16;
    const SPLITTER_GAP = 80;
    const FUSION_HEIGHT = 24;
    const SPLITTER_HEIGHT = 72;

    // Mapa: cto.id → cabos conectados (inputs primeiro, outputs depois)
    const cablesByCtoId = new Map<string, OzCable[]>();
    cables.forEach(c => {
        // Cabo conectado ao CTO se boxA OU boxB for um CTO existente
        if (ctosById.has(c.boxB)) {
            if (!cablesByCtoId.has(c.boxB)) cablesByCtoId.set(c.boxB, []);
            cablesByCtoId.get(c.boxB)!.push(c);
        }
        if (ctosById.has(c.boxA) && c.boxA !== c.boxB) {
            if (!cablesByCtoId.has(c.boxA)) cablesByCtoId.set(c.boxA, []);
            cablesByCtoId.get(c.boxA)!.push(c);
        }
    });

    const layoutByBox = new Map<string, Record<string, { x: number; y: number; rotation: number }>>();
    let autoLayoutCount = 0;
    ctosById.forEach((cto, ctoId) => {
        const flat: Record<string, { x: number; y: number; rotation: number }> = {};

        // Coluna esquerda: cabos empilhados verticalmente (começa em y=0)
        const ctoCables = cablesByCtoId.get(ctoId) || [];
        let yCable = 0;
        ctoCables.forEach(c => {
            const cableHeight = 24 + (c.looseCount || 1) * 12 + c.fiberCount * 24;
            flat[c.id] = { x: COL_CABLE_X, y: yCable, rotation: 0 };
            yCable += cableHeight + CABLE_GAP;
        });
        const cableRangeBottom = yCable; // y total ocupado pelos cabos

        // Coluna direita: splitters CENTRALIZADOS verticalmente em relação aos cabos.
        // Sem isso ficavam no topo sempre, com as linhas dos cabos de baixo
        // atravessando todo o canvas.
        const splittersTotalH = cto.splitters.length * (SPLITTER_HEIGHT + SPLITTER_GAP) - SPLITTER_GAP;
        let ySplitter = Math.max(0, (cableRangeBottom - splittersTotalH) / 2);
        cto.splitters.forEach(s => {
            flat[s.id] = { x: COL_SPLITTER_X, y: ySplitter, rotation: 0 };
            ySplitter += SPLITTER_HEIGHT + SPLITTER_GAP;
        });

        // Coluna meio: bandejas distribuídas ao longo do range vertical dos cabos.
        // Idea: dividir o espaço dos cabos em n+1 faixas e colocar 1 bandeja por
        // faixa — em vez de empilhá-las em um bloco no centro (que faz as fibras
        // do topo e do final cruzarem tudo).
        const n = cto.fusions.length;
        if (n > 0) {
            const usable = Math.max(cableRangeBottom - 60, n * (FUSION_HEIGHT + FUSION_GAP));
            const step = usable / (n + 1);
            cto.fusions.forEach((f, idx) => {
                flat[f.id] = {
                    x: COL_FUSION_X,
                    y: 30 + Math.round(step * (idx + 1) - FUSION_HEIGHT / 2),
                    rotation: 0,
                };
            });
        }

        if (Object.keys(flat).length > 0) {
            layoutByBox.set(ctoId, flat);
            autoLayoutCount++;
        }
    });
    console.log(`[Import] Auto-layout aplicado em ${autoLayoutCount} CTOs (BoxDesign do OZMap ignorado — coords não bate com FTTH)`);

    console.log(`[Import] Inserindo ${ctosById.size} CTOs...`);
    const ctoData = Array.from(ctosById.values()).map(c => ({
        id: c.id,
        projectId: c.projectId,
        name: c.name,
        type: c.type,
        status: c.status as any,
        lat: c.lat,
        lng: c.lng,
        splitters: c.splitters as any,
        fusions: c.fusions as any,
        connections: c.connections as any,
        inputCableIds: c.inputCableIds,
        clientCount: c.clientCount,
        companyId: project.companyId,
        layout: (layoutByBox.get(c.id) || {}) as any,
    }));
    // createMany em batches de 100 pra evitar payload gigante
    for (let i = 0; i < ctoData.length; i += 100) {
        await prisma.cto.createMany({ data: ctoData.slice(i, i + 100), skipDuplicates: true });
    }

    console.log(`[Import] Inserindo ${cablesOut.length} cabos...`);
    const cableData = cablesOut.map(c => ({
        id: c.id,
        projectId: c.projectId,
        name: c.name,
        status: c.status,
        fiberCount: c.fiberCount,
        looseTubeCount: c.looseTubeCount,
        coordinates: c.coordinates as any,
        fromNodeId: c.fromNodeId,
        toNodeId: c.toNodeId,
        technicalReserve: c.technicalReserve,
        companyId: project.companyId,
    }));
    for (let i = 0; i < cableData.length; i += 100) {
        await prisma.cable.createMany({ data: cableData.slice(i, i + 100), skipDuplicates: true });
    }

    console.log('[Import] ✓ Concluído.');
    console.log(`  - CTOs/CEOs:        ${ctoData.length}`);
    console.log(`  - Cabos:            ${cableData.length} (${cablesSkipped} drops/órfãos pulados)`);
    console.log(`  - Splitters:        ${splittersImported}`);
    console.log(`  - Fusões:           ${fusionsImported} (${fusionsSkipped} sem mapeamento)`);
    console.log(`  - Saídas diretas:   ${directOutputsImported}`);
    console.log(`  - Pass-through:     ${passthroughAdded} (${passthroughPairs} pares de cabos)`);
    console.log(`  - Cabos c/ traçado: ${cablesWithRealPath}/${cablesOut.length} (resto = linha reta sem postes)`);
    console.log(`  - Layouts diagrama: ${layoutByBox.size}/${ctoData.length} CTOs (resto = layout default)`);
}

/** Distância em metros usando haversine simples (suficiente pra reserva). */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

main()
    .catch((e) => {
        console.error('[Import] ERRO:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
