import JSZip from 'jszip';

// Ray-casting point-in-polygon test
function pointInPolygon(lat: number, lng: number, polygon: { lat: number; lng: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i].lat, xi = polygon[i].lng;
    const yj = polygon[j].lat, xj = polygon[j].lng;
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Check if any point of a cable intersects the polygon
function cableIntersectsPolygon(coords: { lat: number; lng: number }[], polygon: { lat: number; lng: number }[]): boolean {
  return coords.some(p => pointInPolygon(p.lat, p.lng, polygon));
}

self.onmessage = async (e: MessageEvent) => {
  try {
    const { projectName, nodes, cables, pops, poles, customers, options, polygon } = e.data;

    // Default to true if options not provided (backward compatibility)
    const exportPoles = options?.poles ?? true;
    const exportCables = options?.cables ?? true;
    const exportCTOs = options?.ctos ?? true;
    const exportDrops = options?.drops ?? true;

    // Filter by polygon area if provided
    const hasPolygon = polygon && polygon.length >= 3;
    const filterPoint = (coords: any) => !hasPolygon || (coords && pointInPolygon(coords.lat, coords.lng, polygon));
    const filterCable = (coords: any[]) => !hasPolygon || (coords && cableIntersectsPolygon(coords, polygon));

    const filteredNodes = hasPolygon ? (nodes || []).filter((n: any) => filterPoint(n.coordinates)) : (nodes || []);
    const filteredCables = hasPolygon ? (cables || []).filter((c: any) => filterCable(c.coordinates)) : (cables || []);
    const filteredPops = hasPolygon ? (pops || []).filter((p: any) => filterPoint(p.coordinates)) : (pops || []);
    const filteredPoles = hasPolygon ? (poles || []).filter((p: any) => filterPoint(p.coordinates)) : (poles || []);
    const filteredCustomers = hasPolygon ? (customers || []).filter((c: any) => filterPoint(c.coordinates)) : (customers || []);

    // 1. Generate KML Content
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${escapeXml(projectName || 'Projeto FTTH')}</name>
  <description>Exportado via sistema</description>

  <!-- Styles -->
  <Style id="ctoStyle">
    <IconStyle>
      <scale>0.8</scale>
      <Icon><href>http://maps.google.com/mapfiles/kml/shapes/triangle.png</href></Icon>
      <color>ff0000ff</color> <!-- AABBGGRR (Red) -->
    </IconStyle>
    <LabelStyle>
      <scale>0.6</scale>
    </LabelStyle>
  </Style>
  
  <Style id="popStyle">
    <IconStyle>
      <scale>1.4</scale>
      <Icon><href>https://maps.google.com/mapfiles/kml/shapes/homegardenbusiness.png</href></Icon>
      <color>ffff0000</color> <!-- Blue -->
    </IconStyle>
    <LabelStyle>
      <scale>0.6</scale>
    </LabelStyle>
  </Style>

  <Style id="poleStyle">
    <IconStyle>
      <scale>0.8</scale>
      <Icon><href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      <color>ffffffff</color> <!-- AABBGGRR (White) -->
    </IconStyle>
    <LabelStyle>
      <scale>0.6</scale>
    </LabelStyle>
  </Style>

  <Style id="customerStyle">
    <IconStyle>
      <scale>1.0</scale>
      <Icon><href>https://maps.google.com/mapfiles/kml/shapes/man.png</href></Icon>
      <color>ffffffff</color> <!-- White -->
    </IconStyle>
    <LabelStyle>
      <scale>0.6</scale>
    </LabelStyle>
  </Style>
`;

    // Cables Folder (Rotas e Distribuição)
    if (exportCables && filteredCables.length > 0) {
      kml += `  <Folder>\n    <name>Cabos de Rede</name>\n`;
      for (const cable of filteredCables) {
        const colorHex = (cable.color || '#3b82f6').replace('#', '');
        // Convert #RRGGBB or #RGB to KML AABBGGRR
        const kmlColor = 'ff' +
          (colorHex.length === 3
            ? colorHex[2] + colorHex[2] + colorHex[1] + colorHex[1] + colorHex[0] + colorHex[0]
            : colorHex.substring(4, 6) + colorHex.substring(2, 4) + colorHex.substring(0, 2)
          ).toLowerCase();

        kml += `    <Placemark>
      <name>${escapeXml(cable.name || 'Cabo')}</name>
      <description><![CDATA[Tipo: ${escapeXml(cable.type || '')}<br>Capacidade: ${cable.capacity || 0}<br>Status: ${cable.status || ''}]]></description>
      <Style>
        <LineStyle>
          <color>${kmlColor}</color>
          <width>3</width>
        </LineStyle>
      </Style>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
`;
        if (cable.coordinates && Array.isArray(cable.coordinates)) {
          for (const pt of cable.coordinates) {
            kml += `          ${pt.lng},${pt.lat},0\n`;
          }
        }
        kml += `        </coordinates>
      </LineString>
    </Placemark>\n`;
      }
      kml += `  </Folder>\n`;
    }

    // POPs Folder
    if (exportCTOs && filteredPops.length > 0) {
      kml += `  <Folder>\n    <name>POPs</name>\n`;
      for (const pop of filteredPops) {
        if (pop.coordinates) {
          kml += `    <Placemark>
      <name>${escapeXml(pop.name || 'POP')}</name>
      <styleUrl>#popStyle</styleUrl>
      <Point>
        <coordinates>${pop.coordinates.lng},${pop.coordinates.lat},0</coordinates>
      </Point>
    </Placemark>\n`;
        }
      }
      kml += `  </Folder>\n`;
    }

    // CTOs Folder (and CEOs)
    if (exportCTOs && filteredNodes.length > 0) {
      kml += `  <Folder>\n    <name>Caixas (CTO/CEO)</name>\n`;
      for (const node of filteredNodes) {
        if (node.coordinates) {
          kml += `    <Placemark>
      <name>${escapeXml(node.name || 'Caixa')}</name>
      <description><![CDATA[Tipo: ${escapeXml(node.type || '')}<br>Clientes: ${node.clientCount || 0}]]></description>
      <styleUrl>#ctoStyle</styleUrl>
      <Point>
        <coordinates>${node.coordinates.lng},${node.coordinates.lat},0</coordinates>
      </Point>
    </Placemark>\n`;
        }
      }
      kml += `  </Folder>\n`;
    }

    // Poles Folder
    if (exportPoles && filteredPoles.length > 0) {
      kml += `  <Folder>\n    <name>Postes</name>\n`;
      for (const pole of filteredPoles) {
        if (pole.coordinates) {
          kml += `    <Placemark>
      <name>${escapeXml(pole.name || 'Poste')}</name>
      <styleUrl>#poleStyle</styleUrl>
      <Point>
        <coordinates>${pole.coordinates.lng},${pole.coordinates.lat},0</coordinates>
      </Point>
    </Placemark>\n`;
        }
      }
      kml += `  </Folder>\n`;
    }

    // Customers and Drops Folder
    if (exportDrops && filteredCustomers.length > 0) {
      kml += `  <Folder>\n    <name>Clientes e Drops</name>\n`;
      for (const customer of filteredCustomers) {
        if (customer.coordinates) {
          // Add Customer Marker
          kml += `    <Placemark>
      <name>${escapeXml(customer.name || 'Cliente')}</name>
      <description><![CDATA[Nome: ${escapeXml(customer.name || '')}<br>Plano: ${escapeXml(customer.plan || '')}]]></description>
      <styleUrl>#customerStyle</styleUrl>
      <Point>
        <coordinates>${customer.coordinates.lng},${customer.coordinates.lat},0</coordinates>
      </Point>
    </Placemark>\n`;
        }

        // Add Customer Drop Cable (if exists)
        if (customer.drop && customer.drop.coordinates && customer.drop.coordinates.length > 0) {
          kml += `    <Placemark>
      <name>Drop: ${escapeXml(customer.name || 'Cliente')}</name>
      <description>Cabo Drop do Cliente ${escapeXml(customer.name || '')}</description>
      <Style>
        <LineStyle>
          <color>ff0000ff</color> <!-- Red Drop Line by default for KMZ -->
          <width>2</width>
        </LineStyle>
      </Style>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
`;
          for (const pt of customer.drop.coordinates) {
            kml += `          ${pt.lng},${pt.lat},0\n`;
          }
          kml += `        </coordinates>
      </LineString>
    </Placemark>\n`;
        }
      }
      kml += `  </Folder>\n`;
    }

    kml += `</Document>\n</kml>`;

    // 2. Compress with JSZip
    const zip = new JSZip();
    zip.file("doc.kml", kml);

    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6
      }
    });

    // 3. Send back
    self.postMessage({ success: true, blob });

  } catch (error: any) {
    self.postMessage({ success: false, error: error.message });
  }
};

function escapeXml(unsafe: string) {
  if (!unsafe) return '';
  return unsafe.toString().replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
