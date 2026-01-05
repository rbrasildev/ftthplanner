
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
    // HTML: Wrapper has `paddingBottom` to force total height to mod 24.
    // pt-1.5 (6px) + tubes * (count*12) + gaps (12px)
    const fibersHeight = 6 + (looseTubeCount * fibersPerTube * 12) + ((looseTubeCount - 1) * 12);

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
            <text x="84" y="${totalHeight / 2}" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="11" fill="#0f172a" style="text-transform: uppercase;">${cable.name}</text>
            <text x="84" y="${totalHeight / 2 + 10}" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="9" fill="#64748b" style="text-transform: uppercase;">${cable.fiberCount} FIBRAS</text>
        </g>
    `;

    // 2. FIBERS WRAPPER
    // We render the fibers relative to fibersOffsetX
    // Standard: Border is Left (at 0 relative to wrapper). Padding Left 4. Content at 6.
    // Mirrored: Content at 0. Padding Right 4. Border Right (at 20).

    let currentY = 6;

    // Tube Vertical Line (The Border)
    // Standard: x = fibersOffsetX.
    // Mirrored: x = fibersOffsetX + 20 (FiberWidth 16 + Padding 4).
    // Wait, Border is 2px wide.
    // Standard: x=168. (draws line 168..168? No stroke-width=2 centers on line).
    // Let's assume stroke-width=2 draws from x-1 to x+1.
    // So for Standard, center at 169? (168 + 1).
    // For Mirrored, center at 21? (20 + 1).
    const borderX = isMirrored ? fibersOffsetX + 21 : fibersOffsetX + 1;

    // Using a path or line for the border scaling with height
    // Actually, distinct tubes have space between them. The border is on the `div` wrapper of the tube.
    // The tube wrapper has `pt-1.5`. And `gap-3` (12px) between tube wrappers.
    // So the border breaks?
    // FiberCableNode line 140: `tubes.map(tube => <div ... border-l-2 ...>)`
    // Yes, the border belongs to the tube wrapper. It is interrupted by the gap.

    for (let t = 0; t < looseTubeCount; t++) {
        const tubeColor = getFiberColor(t, cable.colorStandard);
        const startFiber = t * fibersPerTube;
        const count = Math.min(fibersPerTube, cable.fiberCount - startFiber);
        const tubeHeight = count * 12;

        content += `<line x1="${borderX}" y1="${currentY}" x2="${borderX}" y2="${currentY + tubeHeight}" stroke="${tubeColor}" stroke-width="2" />`;

        // Fibers
        // Standard (Left to Right): Border(2) -> Pad(4) -> [Fiber 16].
        //   Fiber Line starts from Border? Or from Content start?
        //   HTML: `<div ... w-4 flex justify-end> <div class="w-full h-[1px] mr-2">`
        //   Typical line: "w-full" (16px).
        //   "mr-2" (8px). Line is 16px wide? No.
        //   Wrapper w-4 (16px).
        //   Inner line `w-full`. `mr-2` pushes it?
        //   Flex item. `w-full` usually means 100% of parent.
        //   `mr-2` puts margin on right.
        //   If parent is 16px. Content is 16px?
        //   Let's simplify:
        //   It looks like a line sticking out of the box.
        //   Let's assume the line goes from Border to Port.
        //   Gap is 4px (padding).
        //   Content is 16px.
        //   Port is at edge.

        // Start X for Fiber Line:
        // Standard: 168 (Border) + 2 (Border Width) + margin?
        // Let's just draw from Border X to Port X.
        // Port X:
        //   Standard: 168(Box) + 2(Border) + 4(Pad) + 16(Width) = 190.
        //   Port circle is at -7px right (-right-[7px]).
        //   So right side of circle is at 190 + 7 = 197.
        //   Center of circle (w=2.5 -> 10px in Tailwind? No w-2.5 is 10px).
        //   So Center = 197 - 5 = 192.

        // Let's settle on:
        // Port Center Standard: 190 + 2 = 192.
        // Port Center Mirrored: 0 - 2 = -2.

        const portCX = isMirrored ? -2 : 192;

        for (let f = 0; f < count; f++) {
            const globalIndex = startFiber + f;
            const fiberId = `${cable.id}-fiber-${globalIndex}`;
            const posInTube = f;
            const color = getFiberColor(posInTube, cable.colorStandard);
            const isLit = litPorts.has(fiberId);

            // User Request: White fiber (03) is invisible on white paper.
            // Force it to a visible gray if not lit.
            const isWhite = color.toLowerCase() === '#ffffff' || color.toLowerCase() === 'white' || color.toLowerCase() === '#fff';
            const strokeColor = isLit ? '#ef4444' : (isWhite ? '#94a3b8' : color);

            const lineY = currentY + (f * 12) + 6;

            // Line from Border to Port
            content += `<line x1="${borderX}" y1="${lineY}" x2="${portCX}" y2="${lineY}" stroke="${strokeColor}" stroke-width="1" />`;

            // User Request: Cable Port Border to be Black.
            content += `<circle cx="${portCX}" cy="${lineY}" r="5" fill="${color}" stroke="${isLit ? '#ef4444' : '#000000'}" stroke-width="1" />`;

            const isLight = [1, 2, 3, 8, 10, 11, 12].includes((posInTube % 12) + 1);
            // Standardize centering: Remove +2 manual offset, use dominant-baseline="middle"
            content += `<text x="${portCX}" y="${lineY}" dominant-baseline="middle" text-anchor="middle" font-size="7" font-weight="bold" fill="${isLight ? 'black' : 'white'}">${globalIndex + 1}</text>`;
        }
        currentY += tubeHeight + 12;
    }

    return `<g transform="translate(${x}, ${y}) rotate(${rotation}, ${cx}, ${cy})">${content}</g>`;
};

const renderSplitter = (splitter: Splitter, x: number, y: number, rotation: number, litPorts: Set<string>): string => {
    const portCount = splitter.outputPortIds.length;
    const width = portCount * 12;
    const height = 72;
    const size = Math.max(width, height);
    const offsetX = (size - width) / 2;
    const offsetY = (size - height) / 2;
    const shiftPx = 6;
    // const skewPercent = (shiftPx / width) * 100; // Unused

    let content = '';

    // Translate to Inner Container
    content += `<g transform="translate(${offsetX}, ${offsetY})">`;

    // Triangle Body
    // Note: The HTML uses a 0-100 scale SVG. We can compute pixels directly.
    // User Request: Borders visible (Black).
    const strokeColor = '#000000';
    const isLitIn = litPorts.has(splitter.inputPortId);
    content += `<polygon points="${width / 2},12 ${shiftPx},60 ${width + shiftPx},60" fill="white" stroke="${isLitIn ? '#ef4444' : strokeColor}" stroke-width="1.5" />`;

    // Label - Add dominant-baseline
    content += `<text x="${width / 2 + shiftPx}" y="${40}" dominant-baseline="middle" text-anchor="middle" font-size="8" font-weight="bold" fill="#64748b">${splitter.type}</text>`;

    // Input Port
    const inX = width / 2;
    const inY = 12; // Top of triangle
    content += `<circle cx="${inX}" cy="${inY}" r="5" fill="white" stroke="${strokeColor}" stroke-width="1" />`;
    // Remove +2 offset, add dominant-baseline="middle"
    content += `<text x="${inX}" y="${inY}" dominant-baseline="middle" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#94a3b8">1</text>`;

    // Output Ports
    // LeftPos in DOM = (idx*12) + 6 - 5. Container Left = 6. Abs Left = (idx*12)+7. Center = (idx*12)+12.
    // Exporter was using (i*12)+6. Missing 6px (shiftPx).
    for (let i = 0; i < portCount; i++) {
        const px = (i * 12) + 12; // Adjusted X (+6px from previous)
        const py = 60; // Exact center of bottom line (Y=60)
        const pid = splitter.outputPortIds[i];
        const isLit = litPorts.has(pid);

        content += `<circle cx="${px}" cy="${py}" r="5" fill="white" stroke="${isLit ? '#ef4444' : strokeColor}" stroke-width="1" />`;
        // Remove +2 offset, add dominant-baseline="middle"
        content += `<text x="${px}" y="${py}" dominant-baseline="middle" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#94a3b8">${i + 1}</text>`;
    }

    content += `</g>`; // End Inner

    // Center of rotation for Splitter is size/2, size/2
    const cx = size / 2;
    const cy = size / 2;

    // Revert Shift Down 4px - Pure Math now
    return `<g transform="translate(${x}, ${y}) rotate(${rotation}, ${cx}, ${cy})">${content}</g>`;
};

const renderFusion = (fusion: FusionPoint, x: number, y: number, rotation: number, litPorts: Set<string>): string => {
    const isLitA = litPorts.has(`${fusion.id}-a`);
    const isLitB = litPorts.has(`${fusion.id}-b`);
    const isLit = isLitA || isLitB;

    let content = '';
    // Center Body
    content += `<circle cx="12" cy="6" r="5" fill="${isLit ? '#ef4444' : '#94a3b8'}" stroke="black" stroke-width="1" />`;

    // Ports (Visual only, no interaction needed for export)
    // Left Port
    content += `<circle cx="2" cy="6" r="4" fill="black" stroke="black" stroke-width="1" />`;
    // Right Port
    content += `<circle cx="22" cy="6" r="4" fill="black" stroke="black" stroke-width="1" />`;

    // Fusion is 24x12. Center 12,6.
    return `<g transform="translate(${x}, ${y + 6}) rotate(${rotation}, 12, 6)">${content}</g>`;
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

const renderFooter = (x: number, y: number, width: number, data: FooterData): string => {
    let content = '';
    const height = 360;

    // Background
    content += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white" stroke="none" />`;

    // Layout Constants
    const col1W = width * 0.35;
    const col2W = width * 0.30;
    // Map takes the rest, usually 35%
    const mapW = width - (col1W + col2W + 10);

    const obsHeight = 110; // More space for OBS
    const topSectionHeight = height - obsHeight - 10;
    const rowH = (topSectionHeight - 10) / 3;

    // --- COLUMN 1 ---
    // Project
    content += `<rect x="${x}" y="${y}" width="${col1W}" height="${rowH}" fill="white" stroke="#cbd5e1" stroke-width="1" />`;
    content += `<text x="${x + 10}" y="${y + rowH * 0.3}" dominant-baseline="middle" font-family="Arial" font-size="14" fill="#64748b">PROJETO</text>`;
    content += `<text x="${x + 10}" y="${y + rowH * 0.7}" dominant-baseline="middle" font-family="Arial" font-weight="bold" font-size="20" fill="#0f172a">${data.projectName || 'SEM NOME'}</text>`;

    // Box
    content += `<rect x="${x}" y="${y + rowH + 5}" width="${col1W}" height="${rowH}" fill="white" stroke="#cbd5e1" stroke-width="1" />`;
    content += `<text x="${x + 10}" y="${y + rowH + 5 + rowH * 0.3}" dominant-baseline="middle" font-family="Arial" font-size="14" fill="#64748b">CAIXA <tspan fill="#94a3b8" font-size="12">(${data.date})</tspan></text>`;
    content += `<text x="${x + 10}" y="${y + rowH + 5 + rowH * 0.7}" dominant-baseline="middle" font-family="Arial" font-weight="bold" font-size="24" fill="#0f172a">${data.boxName}</text>`;

    // Coords
    content += `<rect x="${x}" y="${y + (rowH * 2) + 10}" width="${col1W}" height="${rowH}" fill="white" stroke="#cbd5e1" stroke-width="1" />`;
    content += `<text x="${x + 10}" y="${y + (rowH * 2) + 10 + rowH * 0.3}" dominant-baseline="middle" font-family="Arial" font-size="14" fill="#64748b">LAT/LNG</text>`;
    content += `<text x="${x + 10}" y="${y + (rowH * 2) + 10 + rowH * 0.7}" dominant-baseline="middle" font-family="Arial" font-weight="bold" font-size="18" fill="#0f172a">${data.lat}, ${data.lng}</text>`;

    // --- COLUMN 2 ---
    const c2x = x + col1W + 5;

    // Status
    content += `<rect x="${c2x}" y="${y}" width="${col2W}" height="${rowH}" fill="white" stroke="#cbd5e1" stroke-width="1" />`;
    content += `<text x="${c2x + 10}" y="${y + rowH * 0.3}" dominant-baseline="middle" font-family="Arial" font-size="14" fill="#64748b">STATUS</text>`;
    content += `<text x="${c2x + 10}" y="${y + rowH * 0.7}" dominant-baseline="middle" font-family="Arial" font-weight="bold" font-size="20" fill="#0f172a">${data.status}</text>`;

    // Level
    content += `<rect x="${c2x}" y="${y + rowH + 5}" width="${col2W}" height="${rowH}" fill="white" stroke="#cbd5e1" stroke-width="1" />`;
    content += `<text x="${c2x + 10}" y="${y + rowH + 5 + rowH * 0.3}" dominant-baseline="middle" font-family="Arial" font-size="14" fill="#64748b">NÍVEL</text>`;
    content += `<text x="${c2x + 10}" y="${y + rowH + 5 + rowH * 0.7}" dominant-baseline="middle" font-family="Arial" font-weight="bold" font-size="20" fill="#0f172a">${data.level}</text>`;

    // Pole
    content += `<rect x="${c2x}" y="${y + rowH * 2 + 10}" width="${col2W}" height="${rowH}" fill="white" stroke="#cbd5e1" stroke-width="1" />`;
    content += `<text x="${c2x + 10}" y="${y + rowH * 2 + 10 + rowH * 0.3}" dominant-baseline="middle" font-family="Arial" font-size="14" fill="#64748b">POSTE</text>`;
    content += `<text x="${c2x + 10}" y="${y + rowH * 2 + 10 + rowH * 0.7}" dominant-baseline="middle" font-family="Arial" font-weight="bold" font-size="20" fill="#0f172a">${data.pole || '-'}</text>`;

    // --- OBS ROW ---
    const obsY = y + topSectionHeight + 5;
    content += `<rect x="${x}" y="${obsY}" width="${width}" height="${obsHeight}" fill="white" stroke="#cbd5e1" stroke-width="1" />`;
    content += `<text x="${x + 10}" y="${obsY + 20}" dominant-baseline="middle" font-family="Arial" font-size="14" fill="#64748b">OBSERVAÇÃO</text>`;

    // Obs Text Wrapping
    const maxChars = Math.floor(width / 12); // approx 12px per char? Arial 18 is wide. say 15px.
    const obsLines = breakText(data.obs || '', maxChars);

    let lineY = obsY + 50;
    obsLines.slice(0, 3).forEach(line => { // Max 3 lines
        content += `<text x="${x + 10}" y="${lineY}" dominant-baseline="middle" font-family="Arial" font-weight="bold" font-size="18" fill="#0f172a">${line}</text>`;
        lineY += 24;
    });

    // --- COLUMN 3: MAP ---
    const c3x = c2x + col2W + 5;
    const mapH = topSectionHeight;

    if (data.mapImage) {
        // Use slice for CSS/SVG rendering (cover)
        content += `<image x="${c3x}" y="${y}" width="${mapW}" height="${mapH}" href="${data.mapImage}" preserveAspectRatio="xMidYMid slice" />`;
        content += `<rect x="${c3x}" y="${y}" width="${mapW}" height="${mapH}" fill="none" stroke="#cbd5e1" stroke-width="1" />`;
    } else {
        content += `<rect x="${c3x}" y="${y}" width="${mapW}" height="${mapH}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1" />`;
        content += `<text x="${c3x + mapW / 2}" y="${y + mapH / 2}" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="24" fill="#64748b">MAPA</text>`;
    }

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

    // 1. CALCULATE BOUNDS
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // We reuse the logic from Editor mostly, but simplified for brevity
    // We assume the caller knows the effective bounds or we recalculate:

    const checkPt = (x: number, y: number) => {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    };

    // Use Layout to determine bounds
    if (cto.layout) {
        incomingCables.forEach(c => {
            const l = cto.layout![c.id];
            if (l) { checkPt(l.x, l.y); checkPt(l.x + 200, l.y + 500); } // Rough Estimate
        });
        cto.splitters.forEach(s => {
            const l = cto.layout![s.id];
            if (l) { checkPt(l.x, l.y); checkPt(l.x + (s.outputPortIds.length * 12), l.y + 100); }
        });
        cto.fusions.forEach(f => {
            const l = cto.layout![f.id];
            if (l) { checkPt(l.x, l.y); checkPt(l.x + 24, l.y + 12); }
        });
        cto.connections.forEach(c => {
            // Check points?
            // Assuming points array
            // If no points, we need port positions.
            // Complex. For export, we rely on the points existing in the CTOData if saved.
            // If points are empty, the editor calc'd them on fly.
            // Note: `localCTO` in Editor has the active points. Pass `localCTO` to this func!
            if (c.points) c.points.forEach(p => checkPt(p.x, p.y));
        });
    }

    // Default Bounds if null
    if (minX === Infinity) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

    const PADDING = 50;
    const FOOTER_HEIGHT = footerData ? 360 : 0; // consistent with renderFooter height

    // Initial Bounds with Padding
    minX -= PADDING;
    minY -= PADDING;
    maxX += PADDING;
    maxY += PADDING;

    let width = maxX - minX;
    const contentHeight = maxY - minY;
    const totalHeight = contentHeight + FOOTER_HEIGHT;

    // FORCE LANDSCAPE ASPECT RATIO for Footer Expansion
    // If aspect ratio < 1.4, widen the viewbox
    const targetRatio = 1.4;
    const currentRatio = width / totalHeight;

    if (currentRatio < targetRatio) {
        const targetWidth = totalHeight * targetRatio;
        const diff = targetWidth - width;
        minX -= diff / 2;
        maxX += diff / 2;
        width = targetWidth;
    }

    // Recalculate Width is handled by minX/maxX updates, but explicit var:
    // width = maxX - minX; // (Matches targetWidth)

    const height = totalHeight;

    // 2. RENDER CONNECTIONS (Bottom Layer)
    // We need Port Positions to draw lines if points are partial.
    // However, recreating `getPortCenter` efficiently is hard without DOM.
    // CRITICAL: The `localCTO` passed from Editor SHOULD have fully populated `points` if we ensure it.
    // BUT the editor calculates start/end from DOM. 
    // SOLUTION: We must calculate Port Centers mathematically based on Layout + Component Logic.

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
        // CABLE FIBER
        if (portId.includes('-fiber-')) {
            const cable = incomingCables.find(c => portId.startsWith(c.id));
            if (!cable || !cto.layout?.[cable.id]) return null;
            const l = cto.layout[cable.id];
            const rotation = l.rotation || 0;
            const isMirrored = !!l.mirrored;

            const parts = portId.split('-fiber-');
            const idx = parseInt(parts[1]);
            const looseTubeCount = cable.looseTubeCount || 1;
            const fpt = Math.ceil(cable.fiberCount / looseTubeCount);
            const tubeIdx = Math.floor(idx / fpt);
            const fiberInTube = idx % fpt;

            // Geometry Calc (Must match renderCable)
            // Calculate total height of the cable component
            // Geometry Calc (Must match renderCable)
            // Calculate total height
            // Formula: 6 + (tubes * fibers * 12) + ((tubes - 1) * 12)
            // But we need to account for varying fibers per tube if needed? 
            // Simplified: Sum of all tube heights + (tubes-1)*12 gaps + 6 top padding.
            let sumTubeHeights = 0;
            for (let t = 0; t < looseTubeCount; t++) {
                const startFiberInTube = t * fpt;
                const countFibersInTube = Math.min(fpt, cable.fiberCount - startFiberInTube);
                if (countFibersInTube > 0) {
                    sumTubeHeights += (countFibersInTube * 12);
                }
            }
            const totalGaps = (looseTubeCount > 1) ? (looseTubeCount - 1) * 12 : 0;
            // Also need paddingBottom logic? 
            // renderCable: fibersHeight = 6 + sum + gaps.
            const fibersHeight = 6 + sumTubeHeights + totalGaps;
            const remainder = fibersHeight % 24;
            const paddingBottom = remainder > 0 ? 24 - remainder : 0;
            const totalHeight = fibersHeight + paddingBottom;
            const totalWidth = 190; // Sync with renderCable (190)

            const cx = totalWidth / 2;
            const cy = totalHeight / 2;

            // Start Tube Y
            let yOffset = 6;
            for (let t = 0; t < tubeIdx; t++) {
                const startF = t * fpt;
                const endF = Math.min(startF + fpt, cable.fiberCount);
                const count = endF - startF;
                yOffset += (count * 12) + 12; // +gap
            }

            const lineY = yOffset + (fiberInTube * 12) + 6; // Center Y of port relative to TopLeft

            // Port CX Calculation
            // Standard: 190 + 2 = 192 (Port CX)
            // Mirrored: 0 - 2 = -2 (Port CX)
            // Wait, renderCable uses: isMirrored ? -2 : 192.
            const portRelativeX = isMirrored ? -2 : 192;
            const portRelativeY = lineY;

            // Now apply rotation around (cx, cy)
            const rotated = rotatePoint(portRelativeX, portRelativeY, cx, cy, rotation);

            // Finally translate to Layout Position
            // Revert Nudge - Pure Math
            return { x: l.x + rotated.x, y: l.y + rotated.y };
        }

        // SPLITTER
        if (portId.includes('spl-')) {
            const spl = cto.splitters.find(s => portId.startsWith(s.id));
            if (!spl || !cto.layout?.[spl.id]) return null;
            const l = cto.layout[spl.id];
            const rotation = l.rotation || 0;

            const portCount = spl.outputPortIds.length;
            const width = portCount * 12;
            const height = 72;
            const size = Math.max(width, height); // Square Container
            const offX = (size - width) / 2;
            const offY = (size - height) / 2;
            const cx = size / 2;
            const cy = size / 2;

            // The content is offset by (offX, offY) INSIDE the square size*size.
            // Component is at l.x, l.y.

            let portRelativeX = 0;
            let portRelativeY = 0;

            if (portId === spl.inputPortId) {
                // Input: Relative to Inner Content (width/2, 12).
                // Relative to Node Origin (0,0 of square): offX + width/2, offY + 12
                portRelativeX = offX + (width / 2);
                portRelativeY = offY + 12;
            } else {
                // Output
                const idx = spl.outputPortIds.indexOf(portId);
                if (idx >= 0) {
                    // Center of 12px block: (i*12) + 6
                    // Y: 60 (Synced with Visual Renderer)
                    // Visual X was (idx*12)+12.
                    portRelativeX = offX + (idx * 12) + 12;
                    portRelativeY = offY + 60;
                }
            }

            // Rotate around cx, cy (size/2, size/2)
            const rotated = rotatePoint(portRelativeX, portRelativeY, cx, cy, rotation);

            // Shift Down 4px - REVERTED
            return { x: l.x + rotated.x, y: l.y + rotated.y };
        }

        // FUSION
        if (portId.includes('fus-')) {
            // fus-ID-a or fus-ID-b
            // But we need to find the ID. 
            // Format: fus-${fusion.id}-a
            // fusion.id might be UUID? 
            // Let's iterate fusions to find match.
            const foundFus = cto.fusions.find(f => portId === `${f.id}-a` || portId === `${f.id}-b`);
            if (!foundFus) return null;

            const l = cto.layout?.[foundFus.id];
            if (!l) return null;
            const rotation = l.rotation || 0;

            // Fusion Geometry (renderFusion)
            // Transform: translate(x, y+6) rotate(r, 12, 6)
            // NOTE: The rotation pivot (12, 6) is relative to the *translated* group.
            // The group visual top-left is effectively (l.x, l.y+6).
            // Width 24, Height 12.
            // Left Port: cx=2, cy=6 (Relative to group)
            // Right Port: cx=22, cy=6 (Relative to group)

            // To get absolute coordinates:
            // 1. Point relative to Group Origin (0,0): (2,6) or (22,6)
            // 2. Rotate around Pivot (12,6).
            // 3. Translate by Group Origin (l.x, l.y + 6).

            const px = portId.endsWith('-a') ? 2 : 22;
            const py = 6;

            // Pivot
            const cx = 12;
            const cy = 6;

            const rotated = rotatePoint(px, py, cx, cy, rotation);

            return { x: l.x + rotated.x, y: (l.y + 6) + rotated.y }; // Note +6 y-offset
        }

        return null;
    };

    // Render Connections
    cto.connections.forEach(conn => {
        let p1 = getCalculatedPortCenter(conn.sourceId);
        let p2 = getCalculatedPortCenter(conn.targetId);

        // If we have intermediate points from the editor, use them to anchor
        // But start/end must be precise.
        // If math fails (e.g. rotation), lines might detach.
        // RISK: Rotated elements.
        // MITIGATION: IGNORE rotation in calculation if complexity is too high? 
        // No, user has rotated elements.

        // For now, render the connection path using points if available.
        // Assuming Editor passes `conn.points`.

        let pathD = '';
        if (p1) pathD += `M ${p1.x} ${p1.y} `;

        if (conn.points && conn.points.length > 0) {
            // If p1 is missing, M first point
            if (!p1) pathD += `M ${conn.points[0].x} ${conn.points[0].y} `;
            conn.points.forEach(p => pathD += `L ${p.x} ${p.y} `);
        }

        if (p2) pathD += `L ${p2.x} ${p2.y}`;

        // Attributes
        const isLit = litPorts.has(conn.id) || litPorts.has(conn.sourceId) || litPorts.has(conn.targetId);

        let color = isLit ? '#ef4444' : conn.color;

        // User Request: Splitter to Fusion fiber should be BLACK.
        // Check if ends are splitter/fusion
        const isSplitter = (id: string) => id.includes('spl-');
        const isFusion = (id: string) => id.includes('fus-');

        if (!isLit && (
            (isSplitter(conn.sourceId) && isFusion(conn.targetId)) ||
            (isFusion(conn.sourceId) && isSplitter(conn.targetId))
        )) {
            color = '#000000';
        } else if (!isLit && (conn.color.toLowerCase() === '#ffffff' || conn.color.toLowerCase() === 'white' || conn.color.toLowerCase() === '#fff')) {
            // Visible color for white connections
            color = '#94a3b8';
        }

        const width = isLit ? 4 : 3; // Thicker for visibility export

        svgContent += `<path d="${pathD}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />`;

        // Dots - REMOVED per user request (only show during editing)
        /*
        if (conn.points) {
            conn.points.forEach(p => {
                svgContent += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="white" stroke="${color}" stroke-width="2" />`;
            });
        }
        */
    });

    // 3. RENDER COMPONENTS (Top Layer)
    incomingCables.forEach(c => {
        const l = cto.layout![c.id];
        if (l) svgContent += renderCable(c, l.x, l.y, l.rotation || 0, !!l.mirrored, litPorts);
    });

    cto.splitters.forEach(s => {
        const l = cto.layout![s.id];
        if (l) svgContent += renderSplitter(s, l.x, l.y, l.rotation || 0, litPorts);
    });

    cto.fusions.forEach(f => {
        const l = cto.layout![f.id];
        if (l) svgContent += renderFusion(f, l.x, l.y, l.rotation || 0, litPorts);
    });

    // 6. Draw Footer if data provided
    if (footerData) {
        const footer = renderFooter(minX, maxY, width, footerData);
        svgContent += footer;
    }

    // Wrap in Root SVG
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">${svgContent}</svg>`;
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

    // --- Traversal ---
    const traverse = (node: Element, currentMatrix: Matrix) => {
        try {
            const tagName = node.tagName.toLowerCase();

            let localMatrix: Matrix = [...identity];
            const transAttr = node.getAttribute('transform');
            if (transAttr) {
                const regExp = /(translate|rotate)\s*\(([^)]+)\)/g;
                let match;
                while ((match = regExp.exec(transAttr)) !== null) {
                    const type = match[1];
                    const args = match[2].trim().split(/[\s,]+/).map(parseFloat);
                    if (type === 'translate') {
                        localMatrix = multiply(localMatrix, createTranslate(args[0] || 0, args[1] || 0));
                    } else if (type === 'rotate') {
                        localMatrix = multiply(localMatrix, createRotate(args[0] || 0, args[1] || 0, args[2] || 0));
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
                    pdf.setLineWidth(strokeWidth);
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
                    const baseline = getAttr('dominant-baseline');
                    if (baseline === 'middle' || baseline === 'central') {
                        localY += (fontSize * 0.4);
                    }
                    const pAdjusted = applyToPoint(finalMatrix, x, localY);
                    pdf.text(text, pAdjusted.x, pAdjusted.y, {
                        align: anchor === 'middle' ? 'center' : 'left',
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
