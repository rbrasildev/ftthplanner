
import jsPDF from 'jspdf';
import { Project, PoleData, CTOData, POPData, CableData, Coordinates, POLE_STATUS_COLORS, CTO_STATUS_COLORS } from '../types';

interface ExportOptions {
    project: Project;
    poles: PoleData[];
    mapElementId: string;
    mapBounds?: { north: number; south: number; east: number; west: number } | null;
    t: (key: string) => string;
}

/**
 * Filter network elements to show only those related to technical poles (licensing view)
 */
const filterNetworkForPoles = (project: Project, explicitPoles: PoleData[]) => {
    const net = project.network;

    // 1. Use explicit poles from current view/network
    const poles = explicitPoles || net.poles || [];
    const poleIds = new Set(poles.map(p => p.id));

    // 2. Keep CTOs and POPs linked to poles
    const ctos = net.ctos.filter(c => c.poleId && poleIds.has(c.poleId));
    const pops = (net.pops || []).filter(p => p.poleId && poleIds.has(p.poleId));

    const keptNodeIds = new Set([
        ...poleIds,
        ...ctos.map(c => c.id),
        ...pops.map(p => p.id)
    ]);

    // 3. Keep cables anchored to kept nodes
    const cables = net.cables.filter(c =>
        (c.fromNodeId && keptNodeIds.has(c.fromNodeId)) ||
        (c.toNodeId && keptNodeIds.has(c.toNodeId))
    );

    return { poles, ctos, pops, cables };
};

/**
 * Adjusts the bounding box to match the target pixel aspect ratio,
 * ensuring no stretching occurs.
 */
const adjustBoundsToAspectRatio = (bounds: { north: number, south: number, east: number, west: number }, targetW: number, targetH: number) => {
    const latCenter = (bounds.north + bounds.south) / 2;
    const lngCenter = (bounds.east + bounds.west) / 2;

    // Meter-per-pixel correction for Latitude (approximate)
    const latRatio = Math.cos(latCenter * Math.PI / 180);

    let latSize = bounds.north - bounds.south;
    let lngSize = bounds.east - bounds.west;

    const geoAspect = (lngSize * latRatio) / latSize;
    const targetAspect = targetW / targetH;

    if (geoAspect > targetAspect) {
        // Area is wider than target. Increase latSize.
        const newLatSize = (lngSize * latRatio) / targetAspect;
        return {
            north: latCenter + newLatSize / 2,
            south: latCenter - newLatSize / 2,
            east: bounds.east,
            west: bounds.west
        };
    } else {
        // Area is taller than target. Increase lngSize.
        const newLngSize = (latSize * targetAspect) / latRatio;
        return {
            north: bounds.north,
            south: bounds.south,
            east: lngCenter + newLngSize / 2,
            west: lngCenter - newLngSize / 2
        };
    }
}

/**
 * Project geographic coordinates to local pixel coordinates within a bounding box
 */
const projectToPixel = (coord: any, bounds: { north: number; south: number; east: number; west: number }, width: number, height: number) => {
    let lat: number, lng: number;

    if (Array.isArray(coord)) {
        lng = coord[0];
        lat = coord[1];
    } else {
        lat = coord.lat ?? coord.latitude;
        lng = coord.lng ?? coord.longitude ?? coord.lon;
    }

    if (isNaN(lat) || isNaN(lng)) return { x: -999, y: -999 };

    const lngRange = bounds.east - bounds.west || 0.00001;
    const latRange = bounds.north - bounds.south || 0.00001;

    const x = ((lng - bounds.west) / lngRange) * width;
    const y = ((bounds.north - lat) / latRange) * height;

    return { x: isNaN(x) ? 0 : x, y: isNaN(y) ? 0 : y };
};

/**
 * Fetch Street Data from OpenStreetMap via Overpass API
 */
const fetchOSMData = async (bounds: { north: number; south: number; east: number; west: number }) => {
    const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
    const query = `[out:json][timeout:25];way["highway"](${bbox});out geom;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error("OSM Fetch Error", e);
        return null;
    }
};

export const exportProjectToPDF = async (options: ExportOptions) => {
    let { project, mapBounds, t } = options;

    // 2. Filter network elements
    const filtered = filterNetworkForPoles(project, options.poles);

    // 3. Setup PDF Page and Drawing Area
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2);
    const headerH = 15;
    const footerH = 10;
    const mapAreaH = contentHeight - headerH - footerH - 5;
    const drawW = contentWidth - 4;
    const drawH = mapAreaH;

    // 4. Calculate Optimal BBox (Project Holistic View)
    const allCoords: Coordinates[] = [
        ...filtered.poles.map(p => p.coordinates),
        ...filtered.ctos.map(c => c.coordinates),
        ...filtered.pops.map(p => p.coordinates),
        ...filtered.cables.flatMap(c => c.coordinates)
    ];

    let finalBounds = mapBounds || null;
    if (allCoords.length > 0) {
        const projectBounds = {
            north: Math.max(...allCoords.map(c => c.lat)) + 0.0005,
            south: Math.min(...allCoords.map(c => c.lat)) - 0.0005,
            east: Math.max(...allCoords.map(c => c.lng)) + 0.0005,
            west: Math.min(...allCoords.map(c => c.lng)) - 0.0005
        };
        // Use project bounds for report to ensure everything fits, adjusted for aspect ratio
        finalBounds = adjustBoundsToAspectRatio(projectBounds, drawW, drawH);
    } else if (finalBounds) {
        finalBounds = adjustBoundsToAspectRatio(finalBounds, drawW, drawH);
    }

    // Update mapBounds for the rest of the function
    const currentMapBounds = finalBounds;

    // 5. Fetch OSM Data
    let osmData = null;
    if (currentMapBounds) {
        osmData = await fetchOSMData(currentMapBounds);
    }

    // 4. Drawing Frame Helper
    const drawFrame = (pageNum: number, totalPages: number) => {
        pdf.setDrawColor(180);
        pdf.rect(margin, margin, contentWidth, contentHeight);

        // Header
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, margin, contentWidth, headerH, 'F');
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(40);
        pdf.text("FTTH PLANNER - " + (t('project_report') || "RELATÓRIO DE PROJETO"), margin + 5, margin + 10);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(project.name, margin + contentWidth - 5, margin + 10, { align: 'right' });

        // Footer
        pdf.setFontSize(7);
        pdf.setTextColor(100);
        const dateStr = new Date().toLocaleString();
        pdf.text(`Emitido em: ${dateStr}`, margin + 5, margin + contentHeight - 3);
        pdf.text(`Página ${pageNum} de ${totalPages}`, margin + contentWidth - 5, margin + contentHeight - 3, { align: 'right' });
    };

    // PAGE 1: MAP VIEW (VETORIAL)
    drawFrame(1, 2);

    if (currentMapBounds) {
        const drawX = margin + 2;
        const drawY = margin + headerH + 2;
        const drawW = contentWidth - 4;
        const drawH = mapAreaH;

        // Background (Light Gray for Map Area)
        pdf.setFillColor(248, 248, 248);
        pdf.rect(drawX, drawY, drawW, drawH, 'F');



        // --- DRAW OSM STREETS (VECTORS) ---
        if (osmData && osmData.elements) {
            pdf.setLineWidth(0.18);
            pdf.setDrawColor(120, 120, 120); // Darker gray for streets for better visibility

            osmData.elements.forEach((way: any) => {
                if (way.geometry) {
                    pdf.setLineDashPattern([], 0);
                    for (let i = 0; i < way.geometry.length - 1; i++) {
                        const p1 = projectToPixel({ lat: way.geometry[i].lat, lng: way.geometry[i].lon }, currentMapBounds!, drawW, drawH);
                        const p2 = projectToPixel({ lat: way.geometry[i + 1].lat, lng: way.geometry[i + 1].lon }, currentMapBounds!, drawW, drawH);

                        pdf.line(drawX + p1.x, drawY + p1.y, drawX + p2.x, drawY + p2.y);
                    }

                    // Add Street Name
                    if (way.tags && way.tags.name) {
                        const midIdx = Math.floor(way.geometry.length * 0.4); // Slightly offset for variety
                        const midPt = projectToPixel({ lat: way.geometry[midIdx].lat, lng: way.geometry[midIdx].lon }, currentMapBounds!, drawW, drawH);
                        // Names only if within bounds
                        if (midPt.x > 0 && midPt.x < drawW && midPt.y > 0 && midPt.y < drawH) {
                            pdf.setFontSize(3.8);
                            pdf.setTextColor(80, 80, 80); // Darker text for names
                            pdf.text(way.tags.name, drawX + midPt.x, drawY + midPt.y, { align: 'center', angle: -2 });
                        }
                    }
                }
            });
        }

        // --- DRAW NETWORK (VECTORS) ---

        // 1. Cables
        pdf.setLineWidth(0.5);
        filtered.cables.forEach(cable => {
            pdf.setDrawColor(cable.color || '#0ea5e9');
            if (cable.status === 'NOT_DEPLOYED') pdf.setLineDashPattern([1, 1], 0);
            else pdf.setLineDashPattern([], 0);

            for (let i = 0; i < cable.coordinates.length - 1; i++) {
                const p1 = projectToPixel(cable.coordinates[i], currentMapBounds!, drawW, drawH);
                const p2 = projectToPixel(cable.coordinates[i + 1], currentMapBounds!, drawW, drawH);

                if (p1.x < 0 || p1.x > drawW || p1.y < 0 || p1.y > drawH) {
                    if (p2.x < 0 || p2.x > drawW || p2.y < 0 || p2.y > drawH) continue;
                }

                pdf.line(drawX + p1.x, drawY + p1.y, drawX + p2.x, drawY + p2.y);

                // Cable names removed to reduce clutter as requested
                /*
                if (i === 0) {
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;
                    pdf.setFontSize(4);
                    pdf.setTextColor(50);
                    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
                    pdf.text(cable.name, drawX + midX, drawY + midY - 0.5, { align: 'center', angle });
                }
                */
            }
        });
        pdf.setLineDashPattern([], 0);

        // 2. Poles
        pdf.setLineDashPattern([], 0); // Reset dash pattern
        filtered.poles.forEach(pole => {
            const p = projectToPixel(pole.coordinates, currentMapBounds!, drawW, drawH);
            if (p.x < 0 || p.x > drawW || p.y < 0 || p.y > drawH) return; // Soft clipping

            const color = (POLE_STATUS_COLORS as any)[pole.status] || '#1b1b1b';
            pdf.setDrawColor(0);
            pdf.setFillColor(color);
            pdf.circle(drawX + p.x, drawY + p.y, 0.3, 'FD'); // Smaller pole circles

            pdf.setFontSize(3.5); // Smaller pole labels
            pdf.setTextColor(0);
            pdf.setFont("helvetica", "normal");
            pdf.text(pole.name, drawX + p.x, drawY + p.y - 1.3, { align: 'center' });
        });

        // 3. CTOs / POPs
        pdf.setLineDashPattern([], 0); // Reset dash pattern
        [...filtered.ctos, ...filtered.pops].forEach(node => {
            const p = projectToPixel(node.coordinates, currentMapBounds!, drawW, drawH);
            if (p.x < 0 || p.x > drawW || p.y < 0 || p.y > drawH) return; // Soft clipping

            const color = (node as any).status ? ((CTO_STATUS_COLORS as any)[(node as any).status] || '#f59e0b') : '#3b82f6';
            pdf.setDrawColor(0);
            pdf.setFillColor(color);
            pdf.rect(drawX + p.x - 1.2, drawY + p.y - 1.2, 2.4, 2.4, 'FD');

            pdf.setFontSize(1); // Smaller node labels
            pdf.setTextColor(0);
            pdf.setFont("helvetica", "normal");
            pdf.text(node.name, drawX + p.x, drawY + p.y - 1.5, { align: 'center' });
        });
    }

    // PAGE 2: POLE REPORT
    pdf.addPage();
    drawFrame(2, 2);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(30);
    pdf.text(t('pole_report') || "Relatório de Postes", margin + 5, margin + headerH + 10);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(t('pole_list_desc') || "Lista completa de postes técnicos do projeto.", margin + 5, margin + headerH + 16);

    const tableTop = margin + headerH + 25;
    const colWidths = [50, 40, 60, 40];
    const tableX = margin + 5;

    pdf.setFillColor(240, 240, 240);
    pdf.rect(tableX, tableTop, contentWidth - 10, 8, 'F');
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("ID / Nome", tableX + 2, tableTop + 5);
    pdf.text("Status", tableX + colWidths[0] + 2, tableTop + 5);
    pdf.text(t('location') || "Localização", tableX + colWidths[0] + colWidths[1] + 2, tableTop + 5);
    pdf.text("Tipo / Altura", tableX + colWidths[0] + colWidths[1] + colWidths[2] + 2, tableTop + 5);

    let currentY = tableTop + 8;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);

    filtered.poles.forEach((pole, index) => {
        if (currentY > pageHeight - margin - 20) {
            pdf.addPage();
            const totalPages = (pdf.internal as any).getNumberOfPages();
            drawFrame(totalPages, totalPages);
            currentY = margin + headerH + 10;
        }

        if (index % 2 === 0) {
            pdf.setFillColor(252, 252, 252);
            pdf.rect(tableX, currentY, contentWidth - 10, 7, 'F');
        }

        pdf.text(pole.name, tableX + 2, currentY + 5);
        pdf.text(pole.status, tableX + colWidths[0] + 2, currentY + 5);
        pdf.text(`${pole.coordinates.lat.toFixed(6)}, ${pole.coordinates.lng.toFixed(6)}`, tableX + colWidths[0] + colWidths[1] + 2, currentY + 5);
        pdf.text(`${pole.type || '-'} / ${pole.height || '-'}m`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + 2, currentY + 5);

        currentY += 7;
    });

    pdf.save(`Projeto_${project.name.replace(/\s+/g, '_')}.pdf`);
};
