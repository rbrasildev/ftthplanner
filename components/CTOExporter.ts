
import { CTOData, CableData, FiberConnection, getFiberColor, Splitter, FusionPoint } from '../types';
import jsPDF from 'jspdf';

// --- CONSTANTS ---
const GRID_SIZE = 12;

// --- UTILS ---
const getPortColor = (portId: string, cables: CableData[]): string => {
    if (portId.includes('-fiber-')) {
        try {
            const activeCable = cables.find(c => portId.startsWith(c.id));
            if (!activeCable) return '#94a3b8';

            const parts = portId.split('-fiber-');
            const fiberIndex = parseInt(parts[1]);

            if (!isNaN(fiberIndex)) {
                const looseTubeCount = activeCable.looseTubeCount || 1;
                const fibersPerTube = Math.ceil(activeCable.fiberCount / looseTubeCount);
                // Reset color cycle per tube
                const pos = fiberIndex % fibersPerTube;
                return getFiberColor(pos, activeCable.colorStandard);
            }
        } catch (e) { return '#94a3b8'; }
    }
    if (portId.includes('spl-')) return '#94a3b8';
    return '#94a3b8';
};

// --- SVG HELPERS ---
const createSVGElement = (type: string, attrs: Record<string, string | number>, children: string = '') => {
    const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    // Handle self-closing tags for void elements if needed, but SVG usually likes explicit closers
    return `<${type} ${attrStr}>${children}</${type}>`;
};

// --- RENDERERS ---

const renderCable = (cable: CableData, x: number, y: number, rotation: number, isMirrored: boolean, litPorts: Set<string>): string => {
    const looseTubeCount = cable.looseTubeCount || 1;
    const fibersPerTube = Math.ceil(cable.fiberCount / looseTubeCount);

    // Calculate Geometry (Matching FiberCableNode.tsx)
    // Base Height is calculated from fibers
    // pt-1.5 (6px) per tube + tubes * (count*12) + gaps (12px)
    const fibersHeight = (looseTubeCount * (6 + fibersPerTube * 12)) + ((looseTubeCount - 1) * 12);

    // Grid alignment padding (from FiberCableNode.tsx)
    const remainder = fibersHeight % 24;
    const paddingBottom = remainder > 0 ? 24 - remainder : 0;
    const totalHeight = fibersHeight + paddingBottom;

    // Width Logic (Re-Calculated):
    // Box: 168px
    // Fibers Wrapper:
    //    Border (2px)
    //    Padding (pl-1 or pr-1 -> 4px)
    //    Fiber Row Width (w-4 -> 16px)
    // Total Fiber Col Width = 2 + 4 + 16 = 22px.
    // Total Node Width = 168 + 22 = 190px.

    const totalWidth = 190;
    const cx = totalWidth / 2;
    const cy = totalHeight / 2;

    let content = '';

    // Layout configuration
    // Mirrored: [Fibers 22px][Box 168px]
    // Standard: [Box 168px][Fibers 22px]

    const boxX = isMirrored ? 22 : 0;
    const fibersOffsetX = isMirrored ? 0 : 168;

    // 1. LABEL BOX
    content += `
        <g transform="translate(${boxX}, 0)">
            <rect x="0" y="0" width="168" height="${totalHeight}" fill="white" stroke="#cbd5e1" stroke-width="1" />
            <!-- Centering Fix: Use Center Y for First Line, Offset Second Line Down -->
            <!-- Adding dominant-baseline to ensure PDF alignment logic kicks in -->
            <!-- ADDED data-pdf-align="correction" to fix vertical offset in PDF export (User Request: Match PNG) -->
            <!-- DYNAMIC ALIGNMENT: Check rotation to separate Vertical vs Horizontal logic -->
            <text x="84" y="${totalHeight / 2}" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="11" fill="#0f172a" style="text-transform: uppercase;" data-pdf-align="${(rotation === 90 || rotation === 270) ? 'cable-label-vertical' : 'cable-label-horizontal'}">${cable.name}</text>
            <text x="84" y="${totalHeight / 2 + 10}" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="9" fill="#64748b" style="text-transform: uppercase;" data-pdf-align="${(rotation === 90 || rotation === 270) ? 'cable-label-vertical' : 'cable-label-horizontal'}">${cable.fiberCount} FIBRAS</text>
        </g>
    `;

    // 2. FIBERS WRAPPER
    // We render the fibers relative to fibersOffsetX
    // Standard: Border is Left (at 0 relative to wrapper). Padding Left 4. Content at 6.
    // Mirrored: Content at 0. Padding Right 4. Border Right (at 20).

    let currentY = 0;

    // Tube Vertical Line (The Border)
    const borderX = isMirrored ? fibersOffsetX + 21 : fibersOffsetX + 1;

    for (let t = 0; t < looseTubeCount; t++) {
        const tubeColor = getFiberColor(t, cable.colorStandard);
        const startFiber = t * fibersPerTube;
        const count = Math.min(fibersPerTube, cable.fiberCount - startFiber);

        // HEIGHTS
        const padding = 6; // pt-1.5
        const fibersH = count * 12; // h-3 * count
        const tubeBlockHeight = padding + fibersH; // total visual height of this tube structure

        // Draw Border (Entire Tube Height: Padding + Fibers)
        // From relative 0 to relative height
        content += `<line x1="${borderX}" y1="${currentY}" x2="${borderX}" y2="${currentY + tubeBlockHeight}" stroke="${tubeColor}" stroke-width="2" />`;

        // Draw Fibers
        // Fibers start after padding (6px)
        // Center of first fiber is at +6px from its start.
        // So first fiber Y = currentY + 6(pad) + 6(center) = currentY + 12

        const fibersStartY = currentY + padding;

        const portCX = isMirrored ? -2 : 192;

        for (let f = 0; f < count; f++) {
            const globalIndex = startFiber + f;
            const fiberId = `${cable.id}-fiber-${globalIndex}`;
            const posInTube = f;
            const color = getFiberColor(posInTube, cable.colorStandard);
            const isLit = litPorts.has(fiberId);

            const isWhite = color.toLowerCase() === '#ffffff' || color.toLowerCase() === 'white' || color.toLowerCase() === '#fff';
            const strokeColor = isLit ? '#ef4444' : (isWhite ? '#94a3b8' : color);

            const lineY = fibersStartY + (f * 12) + 6;

            content += `<line x1="${borderX}" y1="${lineY}" x2="${portCX}" y2="${lineY}" stroke="${strokeColor}" stroke-width="1" />`;
            content += `<circle cx="${portCX}" cy="${lineY}" r="5" fill="${color}" stroke="${isLit ? '#ef4444' : '#000000'}" stroke-width="1" />`;

            const isLight = [1, 2, 3, 8, 10, 11, 12].includes((posInTube % 12) + 1);
            content += `<text x="${portCX}" y="${lineY}" dominant-baseline="middle" text-anchor="middle" font-size="7" font-weight="bold" fill="${isLight ? 'black' : 'white'}" data-pdf-align="${(rotation === 90 || rotation === 270) ? 'cable-port-number-vertical' : 'cable-port-number-horizontal'}">${globalIndex + 1}</text>`;
        }

        // Advance Y (Tube Height + Gap 12px)
        currentY += tubeBlockHeight + 12;
    }

    return `<g transform="translate(${x}, ${y}) rotate(${rotation}, ${cx}, ${cy})">${content}</g>`;
};

// --- GEOMETRY HELPERS (Single Source of Truth) ---

const getSplitterGeometry = (splitter: Splitter) => {
    const portCount = splitter.outputPortIds.length;
    const width = portCount * 12;
    const height = 72;
    const size = Math.max(width, height);
    const offsetX = (size - width) / 2;
    const offsetY = (size - height) / 2;
    const shiftPx = 6;

    // Polygon Points (Absolute within Size x Size)
    // Original: width/2,12 shiftPx,60 width+shiftPx,60
    // Adjusted:
    const p1 = `${offsetX + (width / 2) + shiftPx},${offsetY + 12}`; // Added shiftPx to align with Input Port
    const p2 = `${offsetX + shiftPx},${offsetY + 60}`;
    const p3 = `${offsetX + width + shiftPx},${offsetY + 60}`;
    const polygonPoints = `${p1} ${p2} ${p3}`;

    // Label Position
    const labelPos = {
        x: offsetX + (width / 2) + shiftPx,
        y: offsetY + 45 // Keep at 50 for PNG/Editor (Output side)
    };

    const inputPort = {
        id: splitter.inputPortId,
        x: offsetX + (width / 2) + shiftPx, // Added shiftPx to match Editor X alignment (Skew)
        y: offsetY + 12 // Matches Editor Flex Center (12px)
    };

    const outputPorts = splitter.outputPortIds.map((pid, idx) => ({
        id: pid,
        x: offsetX + (idx * 12) + 12, // (idx*12)+12 matches Center X
        y: offsetY + 58 // Verified Y=58 matches HTML
    }));

    return { size, width, height, offsetX, offsetY, inputPort, outputPorts, polygonPoints, labelPos };
};

const getFusionGeometry = (fusion: FusionPoint) => {
    // 24x12 Size centered at 12,6
    return {
        cx: 12, cy: 6,
        leftPort: { x: 6, y: 6 }, // Corrected to 6px
        rightPort: { x: 18, y: 6 } // Corrected to 18px
    };
};

const renderSplitter = (splitter: Splitter, x: number, y: number, rotation: number, litPorts: Set<string>): string => {
    const geo = getSplitterGeometry(splitter);

    let content = '';

    // No Inner Translate Group - Use Absolute Geometry directly

    // Triangle
    const strokeColor = '#000000';
    const isLitIn = litPorts.has(splitter.inputPortId);
    content += `<polygon points="${geo.polygonPoints}" fill="white" stroke="${isLitIn ? '#ef4444' : strokeColor}" stroke-width="1" />`;

    // Label
    content += `<text x="${geo.labelPos.x}" y="${geo.labelPos.y}" dominant-baseline="middle" text-anchor="middle" font-size="8" font-weight="bold" fill="#64748b" data-pdf-align="splitter-label">${splitter.type}</text>`;

    // Input Port
    content += `<circle cx="${geo.inputPort.x}" cy="${geo.inputPort.y}" r="5" fill="white" stroke="${strokeColor}" stroke-width="1" />`;
    content += `<text x="${geo.inputPort.x}" y="${geo.inputPort.y}" dominant-baseline="middle" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#94a3b8" data-pdf-align="splitter-port-number">1</text>`;

    // Output Ports
    geo.outputPorts.forEach((port, idx) => {
        const isLit = litPorts.has(port.id);
        content += `<circle cx="${port.x}" cy="${port.y}" r="5" fill="white" stroke="${isLit ? '#ef4444' : strokeColor}" stroke-width="1" />`;
        content += `<text x="${port.x}" y="${port.y}" dominant-baseline="middle" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#94a3b8" data-pdf-align="splitter-port-number">${idx + 1}</text>`;
    });

    const cx = geo.size / 2;
    const cy = geo.size / 2;
    return `<g transform="translate(${x}, ${y}) rotate(${rotation}, ${cx}, ${cy})">${content}</g>`;
};

const renderFusion = (fusion: FusionPoint, x: number, y: number, rotation: number, litPorts: Set<string>): string => {
    const geo = getFusionGeometry(fusion);
    const isLitA = litPorts.has(`${fusion.id}-a`);
    const isLitB = litPorts.has(`${fusion.id}-b`);
    const isLit = isLitA || isLitB;

    let content = '';
    content += `<circle cx="${geo.cx}" cy="${geo.cy}" r="5" fill="${isLit ? '#ef4444' : '#94a3b8'}" stroke="black" stroke-width="1" />`;
    content += `<circle cx="${geo.leftPort.x}" cy="${geo.leftPort.y}" r="4" fill="black" stroke="black" stroke-width="1" />`;
    content += `<circle cx="${geo.rightPort.x}" cy="${geo.rightPort.y}" r="4" fill="black" stroke="black" stroke-width="1" />`;

    return `<g transform="translate(${x}, ${y}) rotate(${rotation}, ${geo.cx}, ${geo.cy})">${content}</g>`;
};

// --- MAIN EXPORT FUNCTION ---

export interface FooterData {
    projectName: string;
    boxName: string;
    date: string;
    lat: string;
    lng: string;
    status: string;
    level: string;
    pole: string;
    obs: string;
    mapImage?: string; // Data URL
}

const breakText = (text: string, maxChars: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
        if (currentLine.length + 1 + words[i].length <= maxChars) {
            currentLine += ' ' + words[i];
        } else {
            lines.push(currentLine);
            currentLine = words[i];
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
};

// --- ENGINEERING STYLE CONSTANTS ---
const ENG = {
    fontFamily: 'Arial, Roboto, Helvetica, sans-serif',
    colors: {
        border: '#94a3b8', // Slate 400
        textMain: '#0f172a', // Slate 900
        textLabel: '#64748b', // Slate 500
        headerBg: '#f8fafc', // Slate 50
    },
    sizes: {
        headerH: 80,
        footerH: 140, // Expanded for Legend + Tech Data
        margin: 40,
        minWidth: 1191, // A3 Landscape
        width: 1191,
        height: 842
    }
};

const ABNT_COLORS = [
    { name: 'Verde', color: '#009933' },
    { name: 'Amarelo', color: '#FFCC00' },
    { name: 'Branco', color: '#94a3b8' }, // Visible gray for print
    { name: 'Azul', color: '#0033CC' },
    { name: 'Vermelho', color: '#CC0000' },
    { name: 'Violeta', color: '#993399' },
    { name: 'Marrom', color: '#663300' },
    { name: 'Rosa', color: '#FF99CC' },
    { name: 'Preto', color: '#000000' },
    { name: 'Cinza', color: '#999999' },
    { name: 'Laranja', color: '#FF6600' },
    { name: 'Aqua', color: '#00CCFF' }
];

// --- RENDER HELPERS ---

const renderText = (x: number, y: number, text: string, size: number, weight: 'normal' | 'bold' = 'normal', color: string = ENG.colors.textMain, anchor: 'start' | 'middle' | 'end' = 'start') => {
    // Manual baseline adjustment for PDF compatibility
    // y is baseline.
    return `<text x="${x}" y="${y}" font-family="${ENG.fontFamily}" font-weight="${weight}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${text}</text>`;
};

const renderBox = (x: number, y: number, w: number, h: number, bg: string = 'none', border: string = 'none') => {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}" stroke="${border}" stroke-width="1" />`;
};

// --- COMPONENT: HEADER (Top Strip) ---
const renderEngineeringHeader = (x: number, y: number, w: number, data: FooterData) => {
    let content = '';
    const h = ENG.sizes.headerH;

    // Background
    content += renderBox(x, y, w, h, ENG.colors.headerBg, ENG.colors.border);

    // 1. System Logo / Name (Left)
    content += renderText(x + 20, y + 30, 'FTTH PLANNER', 18, 'bold', '#0f172a');
    content += renderText(x + 20, y + 50, 'PROJETO TÉCNICO EXECUTIVO', 10, 'normal', ENG.colors.textLabel);

    // 2. Project Info (Center-Left)
    const col2X = x + 250;
    content += renderText(col2X, y + 25, 'PROJETO', 9, 'normal', ENG.colors.textLabel);
    content += renderText(col2X, y + 45, (data.projectName || 'SEM NOME').toUpperCase(), 14, 'bold', '#0f172a');

    // 3. Box Info (Center-Right)
    const col3X = x + w * 0.55;
    content += renderText(col3X, y + 25, 'CAIXA / CTO', 9, 'normal', ENG.colors.textLabel);
    content += renderText(col3X, y + 45, (data.boxName || '-').toUpperCase(), 14, 'bold', '#0f172a');

    // 4. Meta Info (Right)
    const col4X = x + w - 20;
    content += renderText(col4X, y + 25, 'DATA DE EMISSÃO', 9, 'normal', ENG.colors.textLabel, 'end');
    content += renderText(col4X, y + 45, data.date, 12, 'bold', '#0f172a', 'end');

    return content;
};

// --- COMPONENT: FOOTER (Legend & Tech Data) ---
const renderEngineeringFooter = (x: number, y: number, w: number, data: FooterData) => {
    let content = '';
    const h = ENG.sizes.footerH;
    const LEGEND_W = 350; // Width for color legend
    const INFO_W = w - LEGEND_W;

    // Outer Border
    content += renderBox(x, y, w, h, 'white', ENG.colors.border);

    // --- ZONE 1: ABNT COLOR LEGEND (Left) ---
    content += renderBox(x, y, LEGEND_W, h, 'none', ENG.colors.border);
    content += renderText(x + 15, y + 20, 'LEGENDA DE FIBRAS (PADRÃO ABNT)', 9, 'bold', ENG.colors.textLabel);

    // Grid of colors (2 columns x 6 rows)
    const startY = y + 40;
    const colW = 140;
    const rowH = 15;

    ABNT_COLORS.forEach((item, i) => {
        const cx = x + 20 + (i >= 6 ? colW : 0);
        const cy = startY + ((i % 6) * rowH);

        // Color Swatch
        content += `<rect x="${cx}" y="${cy - 8}" width="12" height="8" fill="${item.color}" stroke="#cbd5e1" stroke-width="0.5" />`;
        // Label
        content += renderText(cx + 20, cy, item.name, 8, 'normal', '#334155');
    });

    // --- ZONE 2: TECHNICAL DATA (Right) ---
    const infoX = x + LEGEND_W;

    // Grid Setup
    const col1X = infoX + 20;
    const col2X = infoX + (INFO_W / 2);

    // Row 1: Location
    const r1y = y + 25;
    content += renderText(col1X, r1y, 'LOCALIZAÇÃO (LAT/LNG)', 9, 'normal', ENG.colors.textLabel);
    content += renderText(col1X, r1y + 18, `${data.lat}, ${data.lng}`, 11, 'bold', '#0f172a');

    content += renderText(col2X, r1y, 'MUNICÍPIO / UF', 9, 'normal', ENG.colors.textLabel);
    content += renderText(col2X, r1y + 18, 'NÃO INFORMADO', 11, 'bold', '#0f172a'); // Placeholder or from Obs

    // Divider
    content += `<line x1="${infoX}" y1="${y + 60}" x2="${x + w}" y2="${y + 60}" stroke="${ENG.colors.border}" stroke-width="1" stroke-dasharray="2,2" />`;

    // Row 2: Tech Specs
    const r2y = y + 85;
    content += renderText(col1X, r2y, 'STATUS / NÍVEL', 9, 'normal', ENG.colors.textLabel);
    content += renderText(col1X, r2y + 18, `${data.status} / ${data.level}`, 11, 'bold', '#0f172a');

    content += renderText(col2X, r2y, 'OBSERVAÇÕES', 9, 'normal', ENG.colors.textLabel);

    // Obs wrap
    const obsLines = breakText(data.obs || '-', 50);
    obsLines.slice(0, 2).forEach((l, i) => {
        content += renderText(col2X, r2y + 18 + (i * 12), l, 10, 'normal', '#0f172a');
    });

    // --- CARIMBO (Bottom Right Corner) ---
    // Signature area
    content += renderText(x + w - 15, y + h - 10, 'FTTH PLANNER SYS 1.0', 7, 'normal', '#94a3b8', 'end');

    return content;
};

export const generateCTOSVG = (
    cto: CTOData,
    incomingCables: CableData[],
    litPorts: Set<string> = new Set(),
    portPositions: Record<string, { x: number, y: number }> = {},
    footerData?: FooterData
): string => {
    let svgContent = '';

    // 1. CALCULATE DIAGRAM BOUNDS (Content Only)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const checkPt = (x: number, y: number) => {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    };

    if (cto.layout) {
        incomingCables.forEach(c => {
            const l = cto.layout![c.id];
            if (l) {
                // Calculate Real BBox Height
                const looseTubeCount = c.looseTubeCount || 1;
                const fibersPerTube = Math.ceil(c.fiberCount / looseTubeCount);
                // Same formula as renderCable
                const fibersHeight = (looseTubeCount * (6 + fibersPerTube * 12)) + ((looseTubeCount - 1) * 12);

                // Add paddingBottom logic (mod 24) matching Editor/Render
                const remainder = fibersHeight % 24;
                const paddingBottom = remainder > 0 ? 24 - remainder : 0;
                const totalHeight = fibersHeight + paddingBottom;

                checkPt(l.x, l.y);
                checkPt(l.x + 190, l.y + totalHeight);
            }
        });
        cto.splitters.forEach(s => {
            const l = cto.layout![s.id];
            if (l) { checkPt(l.x, l.y); checkPt(l.x + (s.outputPortIds.length * 12), l.y + 72); }
        });
        cto.fusions.forEach(f => {
            const l = cto.layout![f.id];
            if (l) { checkPt(l.x, l.y); checkPt(l.x + 24, l.y + 12); }
        });
        cto.connections.forEach(c => {
            if (c.points) c.points.forEach(p => checkPt(p.x, p.y));
        });
    }

    if (minX === Infinity) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

    // Diagram Size
    const diaW = maxX - minX;
    const diaH = maxY - minY;

    // 2. SETUP PAGE LAYOUT (A3 Landscape Engineering Standard)
    const PAGE_W = 1191;
    const PAGE_H = 842;
    const MARGIN = ENG.sizes.margin;
    const HEADER_H = ENG.sizes.headerH;
    const FOOTER_H = footerData ? ENG.sizes.footerH : 0;

    // Available Content Area
    const AVAIL_W = PAGE_W - (MARGIN * 2);
    const AVAIL_H = PAGE_H - HEADER_H - FOOTER_H - (MARGIN * 2);

    // 3. SCALE CALCULATION
    // Fit diagram into available area with 95% fill factor
    let scale = Math.min(AVAIL_W / diaW, AVAIL_H / diaH) * 0.95;

    // --- MANUAL SCALE LIMIT (PDF/PNG) ---
    // User Request: Prevent huge zoom when few elements.
    const manualMaxScale = 1; // MANIPULE AQUI: Limite máximo de zoom (ex: 1.5, 2.0, 3.0)

    // Safety clamps
    if (diaW === 0 || diaH === 0) scale = 1;
    if (scale > 5) scale = 5; // Absolute hard limit
    if (scale > manualMaxScale) scale = manualMaxScale; // Apply User Limit

    // 4. CENTERING LOGIC
    const diaCenterX = minX + diaW / 2;
    const diaCenterY = minY + diaH / 2;

    const pageCenterX = PAGE_W / 2;
    // Align content center to the middle of the available vertical space
    const pageContentCenterY = HEADER_H + MARGIN + (AVAIL_H / 2);

    // Construct Transform: Move PageCenter, Scale, Move Back DiagramCenter
    const finalTransform = `translate(${pageCenterX}, ${pageContentCenterY}) scale(${scale}) translate(${-diaCenterX}, ${-diaCenterY})`;

    // 5. RENDER FRAME (Header & Footer)
    if (footerData) {
        svgContent += renderEngineeringHeader(0, 0, PAGE_W, footerData);
        svgContent += renderEngineeringFooter(0, PAGE_H - ENG.sizes.footerH, PAGE_W, footerData);
    }

    // 5. RENDER DIAGRAM (Shifted)
    let diagramContent = '';

    // --- HELPER: Rotate Point around Center ---
    const rotatePoint = (x: number, y: number, cx: number, cy: number, angleDeg: number): { x: number, y: number } => {
        if (!angleDeg) return { x, y };
        const angleRad = (angleDeg * Math.PI) / 180;
        const dx = x - cx;
        const dy = y - cy;
        const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
        const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
        return { x: cx + rotatedX, y: cy + rotatedY };
    };

    const getCalculatedPortCenter = (portId: string): { x: number, y: number } | null => {
        // CABLE FIBER: Use DOM position (portPositions) where possible, OR SSoT if implemented.
        // For professional export, trusting the exact layout from Editor is safest for simple nodes.
        // We return null here to fallback to portPositions or Editor Points for fibers.
        // ONLY Component-Inside logic (Splitter/Fusion) is strictly enforced here.

        // SPLITTER USING SHARED GEOMETRY
        if (portId.includes('spl-')) {
            const spl = cto.splitters.find(s => portId.startsWith(s.id));
            if (!spl || !cto.layout?.[spl.id]) return null;
            const l = cto.layout[spl.id];
            const rotation = l.rotation || 0;

            const geo = getSplitterGeometry(spl);
            const cx = geo.size / 2;
            const cy = geo.size / 2;

            let portRelativeX = 0;
            let portRelativeY = 0;

            if (portId === spl.inputPortId) {
                // Input Port
                portRelativeX = geo.inputPort.x;
                portRelativeY = geo.inputPort.y;
            } else {
                // Output Port
                const outPort = geo.outputPorts.find(p => p.id === portId);
                if (outPort) {
                    portRelativeX = outPort.x;
                    portRelativeY = outPort.y;
                }
            }

            const rotated = rotatePoint(portRelativeX, portRelativeY, cx, cy, rotation);
            return { x: l.x + rotated.x, y: l.y + rotated.y };
        }

        // FUSION USING SHARED GEOMETRY
        if (portId.includes('fus-')) {
            const foundFus = cto.fusions.find(f => portId === `${f.id}-a` || portId === `${f.id}-b`);
            if (!foundFus) return null;

            const l = cto.layout?.[foundFus.id];
            if (!l) return null;
            const rotation = l.rotation || 0;

            const geo = getFusionGeometry(foundFus);

            const pk = portId.endsWith('-a') ? 'leftPort' : 'rightPort';
            const px = geo[pk].x;
            const py = geo[pk].y;

            const rotated = rotatePoint(px, py, geo.cx, geo.cy, rotation);

            return { x: l.x + rotated.x, y: l.y + rotated.y };
        }

        return null; // Fallback
    };

    // RENDER CONNECTIONS
    cto.connections.forEach(conn => {
        // FIXED: Force Math Calculation for Components (Splitter/Fusion) 
        const isComponent = (id: string) => id.includes('spl-') || id.includes('fus-');
        let p1 = isComponent(conn.sourceId) ? getCalculatedPortCenter(conn.sourceId) : (portPositions[conn.sourceId] || getCalculatedPortCenter(conn.sourceId));
        let p2 = isComponent(conn.targetId) ? getCalculatedPortCenter(conn.targetId) : (portPositions[conn.targetId] || getCalculatedPortCenter(conn.targetId));

        let pathD = '';
        if (p1) pathD += `M ${p1.x} ${p1.y} `;
        if (conn.points && conn.points.length > 0) {
            if (!p1) pathD += `M ${conn.points[0].x} ${conn.points[0].y} `;
            conn.points.forEach(p => pathD += `L ${p.x} ${p.y} `);
        }
        if (p2) pathD += `L ${p2.x} ${p2.y}`;

        const isLit = litPorts.has(conn.id) || litPorts.has(conn.sourceId) || litPorts.has(conn.targetId);
        let color = isLit ? '#ef4444' : conn.color;

        const isSplitter = (id: string) => id.includes('spl-');
        const isFusion = (id: string) => id.includes('fus-');
        if (!isLit && ((isSplitter(conn.sourceId) && isFusion(conn.targetId)) || (isFusion(conn.sourceId) && isSplitter(conn.targetId)))) {
            color = '#000000';
        } else if (!isLit && (conn.color === '#ffffff' || conn.color === 'white' || conn.color === '#fff' || conn.color === '#FFF')) {
            color = '#94a3b8'; // Visible for white
        }

        // MANIPULE AQUI: Espessura da linha da fibra (Padrão era 2)
        const manualFiberThickness = 1.2;
        const width = isLit ? (manualFiberThickness + 0.5) : manualFiberThickness;
        diagramContent += `<path d="${pathD}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />`;
    });

    // RENDER COMPONENTS
    incomingCables.forEach(c => {
        const l = cto.layout![c.id];
        if (l) diagramContent += renderCable(c, l.x, l.y, l.rotation || 0, !!l.mirrored, litPorts);
    });

    cto.splitters.forEach(s => {
        const l = cto.layout![s.id];
        if (l) diagramContent += renderSplitter(s, l.x, l.y, l.rotation || 0, litPorts);
    });

    cto.fusions.forEach(f => {
        const l = cto.layout![f.id];
        if (l) diagramContent += renderFusion(f, l.x, l.y, l.rotation || 0, litPorts);
    });

    // Wrap Diagram in Translation Group
    // Wrap Diagram in Translation/Scale Group
    svgContent += `<g transform="${finalTransform}">${diagramContent}</g>`;

    // Final SVG with fixed A3 ViewBox
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${PAGE_W}" height="${PAGE_H}" preserveAspectRatio="xMidYMid meet">${svgContent}</svg>`;
};


export const exportToPNG = async (svgString: string, filename: string) => {
    return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
        img.onload = () => {
            const canvas = document.createElement('canvas');
            // 3x Scaling for Quality
            // 3x Scaling for Quality
            const scale = 3;
            const contentW = img.width * scale;
            const contentH = img.height * scale;

            // Force Landscape Aspect Ratio
            // If Height > Width, expand Width to be at least Height * 1.3
            let canvasW = contentW;
            let canvasH = contentH;

            if (canvasH > canvasW) {
                canvasW = canvasH * 1.4; // 1.4 landscape ratio
            } else {
                // Even if wide, ensure minimum landscapeiness?
                // User said "tenta deixa página em paisagem"
                canvasW = Math.max(canvasW, canvasH * 1.4);
            }

            const offsetX = (canvasW - contentW) / 2;
            const offsetY = (canvasH - contentH) / 2;

            canvas.width = canvasW;
            canvas.height = canvasH;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // White Background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.drawImage(img, offsetX, offsetY, contentW, contentH);

            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();
            resolve();
        };
        img.onerror = reject;
    });
};

export const exportToPDF = async (svgString: string, filename: string) => {
    // 1. Parse SVG
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svg = doc.documentElement;

    // Robust ViewBox Parsing
    // Robust ViewBox Parsing
    let viewBoxAttrs = svg.getAttribute('viewBox') || svg.getAttribute('viewbox');
    if (!viewBoxAttrs) {
        const match = svgString.match(/viewBox=["']([^"']+)["']/i);
        if (match) viewBoxAttrs = match[1];
    }
    const viewBox = viewBoxAttrs?.split(/[\s,]+/).map(Number) || [0, 0, 800, 600];

    // Safety check for NaN or Zero in content dimensions
    const contentWidth = (isNaN(viewBox[2]) || viewBox[2] <= 0) ? 800 : viewBox[2];
    const contentHeight = (isNaN(viewBox[3]) || viewBox[3] <= 0) ? 600 : viewBox[3];

    // Force Landscape Page
    let pdfWidth = contentWidth;
    let pdfHeight = contentHeight;

    if (pdfHeight > pdfWidth) {
        pdfWidth = pdfHeight * 1.3;
    } else {
        pdfWidth = Math.max(pdfWidth, pdfHeight * 1.3);
    }

    // Safety check for NaN or Zero in PDF dimensions
    if (isNaN(pdfWidth) || pdfWidth <= 0) pdfWidth = 1122;
    if (isNaN(pdfHeight) || pdfHeight <= 0) pdfHeight = 793;

    const pdfOffsetX = (pdfWidth - contentWidth) / 2;
    const pdfOffsetY = (pdfHeight - contentHeight) / 2;

    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: [pdfWidth, pdfHeight]
    });

    try {
        pdf.setFillColor('#ffffff');
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
    } catch (e) {
        console.error('PDF Init Error', e);
    }

    // --- Preload Images for Aspect Ratio Calculations ---
    const imageCache: Record<string, HTMLImageElement> = {};
    const images = Array.from(svg.querySelectorAll('image'));

    await Promise.all(images.map(img => {
        const href = img.getAttribute('href') || img.getAttribute('xlink:href');
        if (!href) return Promise.resolve();
        return new Promise<void>((resolve) => {
            const tempImg = new Image();
            tempImg.crossOrigin = 'Anonymous'; // Enable CORS
            tempImg.src = href;
            tempImg.onload = () => {
                imageCache[href] = tempImg;
                resolve();
            };
            tempImg.onerror = () => {
                console.warn('Failed to load image for PDF export:', href);
                resolve(); // Ignore errors
            };
        });
    }));

    // --- Matrix Helpers ---
    type Matrix = [number, number, number, number, number, number];
    const identity: Matrix = [1, 0, 0, 1, 0, 0];

    const multiply = (m1: Matrix, m2: Matrix): Matrix => {
        const [a1, b1, c1, d1, e1, f1] = m1;
        const [a2, b2, c2, d2, e2, f2] = m2;
        return [
            a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
            a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1
        ];
    };

    const applyToPoint = (m: Matrix, x: number, y: number): { x: number, y: number } => {
        return {
            x: m[0] * x + m[2] * y + m[4],
            y: m[1] * x + m[3] * y + m[5]
        };
    };

    const createTranslate = (tx: number, ty: number): Matrix => [1, 0, 0, 1, tx, ty];

    const createRotate = (angleDeg: number, cx: number = 0, cy: number = 0): Matrix => {
        const rad = (angleDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const t1 = createTranslate(-cx, -cy);
        const r: Matrix = [cos, sin, -sin, cos, 0, 0];
        const t2 = createTranslate(cx, cy);
        return multiply(t2, multiply(r, t1));
    };

    const createScale = (sx: number, sy?: number): Matrix => [sx, 0, 0, sy ?? sx, 0, 0];

    // --- Traversal ---
    const traverse = (node: Element, currentMatrix: Matrix) => {
        try {
            const tagName = node.tagName.toLowerCase();

            let localMatrix: Matrix = [...identity];
            const transAttr = node.getAttribute('transform');
            if (transAttr) {
                // ADDED: support for scale
                const regExp = /(translate|rotate|scale)\s*\(([^)]+)\)/g;
                let match;
                while ((match = regExp.exec(transAttr)) !== null) {
                    const type = match[1];
                    const args = match[2].trim().split(/[\s,]+/).map(parseFloat);
                    if (type === 'translate') {
                        localMatrix = multiply(localMatrix, createTranslate(args[0] || 0, args[1] || 0));
                    } else if (type === 'rotate') {
                        localMatrix = multiply(localMatrix, createRotate(args[0] || 0, args[1] || 0, args[2] || 0));
                    } else if (type === 'scale') {
                        localMatrix = multiply(localMatrix, createScale(args[0] || 1, args[1]));
                    }
                }
            }
            const finalMatrix = multiply(currentMatrix, localMatrix);

            const getAttr = (name: string) => node.getAttribute(name);
            const num = (name: string, def = 0) => {
                const val = parseFloat(node.getAttribute(name) || String(def));
                return isNaN(val) ? def : val;
            };
            const color = (name: string, def = '#000') => node.getAttribute(name);

            const fill = color('fill', 'none');
            const strokeAttr = node.getAttribute('stroke');
            const strokeVal = strokeAttr || '#000000';
            const strokeWidth = num('stroke-width', 1);

            let drawMode = '';
            const hasFill = fill !== 'none' && fill !== 'transparent';
            const hasStroke = strokeVal !== 'none' && strokeVal !== 'transparent';
            if (hasFill && hasStroke) drawMode = 'FD';
            else if (hasFill) drawMode = 'F';
            else if (hasStroke) drawMode = 'S';

            if (drawMode) {
                if (hasStroke) {
                    pdf.setDrawColor(strokeVal);

                    // ESCALAMENTO DINÂMICO DE BORDAS:
                    // Se o desenho for grande (escala < 1), as bordas diminuem proporcionalmente.
                    // Exceto se houver vector-effect="non-scaling-stroke".
                    const scaleFactor = Math.sqrt(finalMatrix[0] * finalMatrix[0] + finalMatrix[1] * finalMatrix[1]);
                    const isNonScaling = node.getAttribute('vector-effect') === 'non-scaling-stroke';

                    let finalLineWidth = strokeWidth;
                    if (!isNonScaling) {
                        finalLineWidth *= scaleFactor;
                    }

                    // Garantir um mínimo de 0.2pt para não sumir na impressão
                    pdf.setLineWidth(Math.max(0.2, finalLineWidth));
                }
                if (hasFill) pdf.setFillColor(fill);
            }

            if (tagName === 'g' || tagName === 'svg') {
                Array.from(node.children).forEach(child => traverse(child, finalMatrix));
            } else if (tagName === 'rect') {
                const x = num('x');
                const y = num('y');
                const w = num('width');
                const h = num('height');
                if (!isNaN(x) && drawMode) {
                    const p1 = applyToPoint(finalMatrix, x, y);
                    const p2 = applyToPoint(finalMatrix, x + w, y);
                    const p3 = applyToPoint(finalMatrix, x + w, y + h);
                    const p4 = applyToPoint(finalMatrix, x, y + h);

                    const lines = [
                        [p2.x - p1.x, p2.y - p1.y],
                        [p3.x - p2.x, p3.y - p2.y],
                        [p4.x - p3.x, p4.y - p3.y],
                        [p1.x - p4.x, p1.y - p4.y]
                    ];
                    pdf.lines(lines, p1.x, p1.y, [1, 1], drawMode, true);
                }
            } else if (tagName === 'circle') {
                const cx = num('cx');
                const cy = num('cy');
                const r = num('r');
                if (!isNaN(cx) && drawMode) {
                    const p = applyToPoint(finalMatrix, cx, cy);
                    const scale = Math.sqrt(finalMatrix[0] * finalMatrix[0] + finalMatrix[1] * finalMatrix[1]);
                    pdf.circle(p.x, p.y, r * scale, drawMode);
                }
            } else if (tagName === 'line') {
                if (hasStroke) {
                    const p1 = applyToPoint(finalMatrix, num('x1'), num('y1'));
                    const p2 = applyToPoint(finalMatrix, num('x2'), num('y2'));
                    pdf.line(p1.x, p1.y, p2.x, p2.y);
                }
            } else if (tagName === 'text') {
                const x = num('x');
                const y = num('y');
                const text = node.textContent || '';
                const fontSize = num('font-size', 10);
                const anchor = getAttr('text-anchor');
                if (hasFill && text.trim()) {
                    const scale = Math.sqrt(finalMatrix[0] * finalMatrix[0] + finalMatrix[1] * finalMatrix[1]);
                    pdf.setFontSize(fontSize * scale);
                    const angleRad = Math.atan2(finalMatrix[1], finalMatrix[0]);
                    const angleDeg = (angleRad * 180) / Math.PI;

                    let localY = y;
                    let localX = x; // Propagate X to be mutable

                    const baseline = getAttr('dominant-baseline');
                    const pdfAlign = getAttr('data-pdf-align'); // Check for correction flag

                    if (baseline === 'middle' || baseline === 'central') {
                        // User Request: Cable Labels (correction) need different offset to match PNG.
                        // Standard (Fiber Numbers) uses 0.4.
                        // Correction (Cable Labels) uses 0.30 (Lifts text slightly).
                        // Standard (Fiber Numbers) uses 0.4.
                        // --- AJUSTE FINO MANUAL (PDF ONLY) ---
                        let offsetFactor = 0.5;
                        let extraPixelShiftY = 0; // Mexe no eixo Y local (Pode ser Horizontal visual se girado)
                        let extraPixelShiftX = 0; // Mexe no eixo X local (Pode ser Vertical visual se girado)

                        if (pdfAlign === 'correction') {
                            offsetFactor = 0.3;     // Legacy fallback
                        }
                        if (pdfAlign === 'cable-label-horizontal') {
                            offsetFactor = 0.3;
                            extraPixelShiftY = 0;   // Ajuste H
                            extraPixelShiftX = 0;   // Ajuste V
                        }
                        if (pdfAlign === 'cable-label-vertical') {
                            offsetFactor = 0.3;
                            extraPixelShiftY = -40;   // Ajuste H (no visual girado)
                            extraPixelShiftX = -30;   // Ajuste V (no visual girado) -> TENTE AQUI PARA CABO EM PÉ
                        }
                        if (pdfAlign === 'cable-port-number-horizontal') {
                            offsetFactor = 0.4;
                            extraPixelShiftY = 0;
                            extraPixelShiftX = 0;
                        }
                        if (pdfAlign === 'cable-port-number-vertical') {
                            offsetFactor = 0.4;
                            extraPixelShiftY = -2;   // Ajuste H
                            extraPixelShiftX = -1;   // Ajuste V -> TENTE AQUI PARA BOLINHAS DO CABO EM PÉ
                        }
                        if (pdfAlign === 'splitter-label') {
                            offsetFactor = 1.3;
                            extraPixelShiftY = 0;
                            extraPixelShiftX = -20; // TENTE AQUI: Se Y mexeu na horizontal, X mexerá na vertical!
                        }
                        if (pdfAlign === 'splitter-port-number') {
                            // Ajuste Fino para Números das Portas (Bolinhas)
                            offsetFactor = 0.4;
                            extraPixelShiftY = 1.3; // AXIS Y (Vertical visualmente se não girado)
                            extraPixelShiftX = -3; // AXIS X
                        }

                        localX += extraPixelShiftX;
                        localY += (fontSize * offsetFactor) + extraPixelShiftY;

                    }
                    const pAdjusted = applyToPoint(finalMatrix, localX, localY);

                    // Map SVG text-anchor to jsPDF align
                    let pdfAlignOpt: 'left' | 'center' | 'right' = 'left';
                    if (anchor === 'middle') pdfAlignOpt = 'center';
                    if (anchor === 'end') pdfAlignOpt = 'right';

                    pdf.text(text, pAdjusted.x, pAdjusted.y, {
                        align: pdfAlignOpt,
                        angle: -angleDeg,
                        baseline: 'bottom'
                    });
                }
            } else if (tagName === 'path') {
                const d = getAttr('d');
                if (d && hasStroke) {
                    const parts = d.trim().split(/[\s,]+/);
                    let ops: { op: string, args: number[] }[] = [];
                    for (let i = 0; i < parts.length; i++) {
                        const token = parts[i];
                        if (token === 'M' || token === 'L') {
                            ops.push({ op: token, args: [parseFloat(parts[++i]), parseFloat(parts[++i])] });
                        }
                    }
                    for (let i = 1; i < ops.length; i++) {
                        const prev = ops[i - 1];
                        const curr = ops[i];
                        if (prev.args.length === 2 && curr.args.length === 2 &&
                            !isNaN(prev.args[0]) && !isNaN(prev.args[1]) &&
                            !isNaN(curr.args[0]) && !isNaN(curr.args[1])) {
                            const p1 = applyToPoint(finalMatrix, prev.args[0], prev.args[1]);
                            const p2 = applyToPoint(finalMatrix, curr.args[0], curr.args[1]);
                            pdf.line(p1.x, p1.y, p2.x, p2.y);
                        }
                    }
                }
            } else if (tagName === 'polygon' || tagName === 'polyline') {
                const pointsAttr = getAttr('points') || '';
                const pointsRaw = pointsAttr.trim().split(/[\s,]+/);
                if (pointsRaw.length >= 2 && drawMode) {
                    const points: { x: number, y: number }[] = [];
                    for (let i = 0; i < pointsRaw.length; i += 2) {
                        const px = parseFloat(pointsRaw[i]);
                        const py = parseFloat(pointsRaw[i + 1]);
                        if (!isNaN(px) && !isNaN(py)) {
                            points.push(applyToPoint(finalMatrix, px, py));
                        }
                    }
                    if (points.length >= 2) {
                        const pdfLines: number[][] = [];
                        const start = points[0];
                        for (let i = 1; i < points.length; i++) {
                            pdfLines.push([points[i].x - points[i - 1].x, points[i].y - points[i - 1].y]);
                        }
                        const isClosed = tagName === 'polygon';
                        pdf.lines(pdfLines, start.x, start.y, [1, 1], drawMode, isClosed);
                    }
                }
            } else if (tagName === 'image') {
                const x = num('x');
                const y = num('y');
                const w = num('width');
                const h = num('height');
                const href = getAttr('href') || getAttr('xlink:href');

                if (href && !isNaN(x)) {
                    const p = applyToPoint(finalMatrix, x, y);
                    const scaleM = Math.sqrt(finalMatrix[0] * finalMatrix[0] + finalMatrix[1] * finalMatrix[1]);
                    const targetW = (w > 0 ? w : 100) * scaleM;
                    const targetH = (h > 0 ? h : 100) * scaleM;

                    // Try to use cache first
                    if (imageCache[href]) {
                        const srcImg = imageCache[href];
                        const sRatio = srcImg.width / srcImg.height;
                        const tRatio = targetW / targetH;

                        // Avoid division by zero
                        if (srcImg.height > 0 && srcImg.width > 0) {
                            let drawW, drawH, dx, dy;
                            if (sRatio > tRatio) {
                                drawH = targetH;
                                drawW = srcImg.width * (targetH / srcImg.height);
                                dx = p.x - (drawW - targetW) / 2;
                                dy = p.y;
                            } else {
                                drawW = targetW;
                                drawH = srcImg.height * (targetW / srcImg.width);
                                dx = p.x;
                                dy = p.y - (drawH - targetH) / 2;
                            }

                            pdf.saveGraphicsState();
                            pdf.rect(p.x, p.y, targetW, targetH, 'clip');
                            try {
                                pdf.addImage(srcImg, 'PNG', dx, dy, drawW, drawH);
                            } catch (e) {
                                console.warn('PDF AddImage HTMLImageElement failed', e);
                                try {
                                    pdf.addImage(srcImg.src, 'PNG', dx, dy, drawW, drawH);
                                } catch (e2) {
                                    try {
                                        pdf.addImage(href, 'PNG', p.x, p.y, targetW, targetH);
                                    } catch (e3) { }
                                }
                            }
                            pdf.restoreGraphicsState();
                        }
                    } else {
                        // Fallback if cache missing
                        try {
                            pdf.addImage(href, 'PNG', p.x, p.y, targetW, targetH);
                        } catch (e) {
                            console.error('PDF AddImage Direct failed', e);
                        }
                    }
                }
            }
        } catch (tagErr) {
            console.error(`Error processing tag ${node.tagName}`, tagErr);
        }
    };

    const initialMatrix = createTranslate(-viewBox[0] + pdfOffsetX, -viewBox[1] + pdfOffsetY);
    traverse(svg, initialMatrix);
    try {
        pdf.save(filename);
    } catch (e) {
        console.error('Error saving PDF:', e);
        alert('Failed to save PDF. Please check console for details.');
    }
};
