import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as saasService from '../services/saasService';
import L from 'leaflet';
import * as d3 from 'd3';
import { useTheme } from '../ThemeContext';

// Fix Leaflet Default Icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

export const SaasAnalytics: React.FC<{ companies?: any[] }> = ({ companies = [] }) => {
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { theme } = useTheme();

    // Refs for D3
    const growthChartRef = useRef<SVGSVGElement>(null);
    const densityChartRef = useRef<SVGSVGElement>(null);
    const plansChartRef = useRef<SVGSVGElement>(null);

    // Calculate Infrastructure KPIs
    const totalCTOs = companies.reduce((acc, c) => acc + (c._count?.ctos || 0), 0);
    const totalPOPs = companies.reduce((acc, c) => acc + (c._count?.pops || 0), 0);
    const totalRevenue = companies.reduce((acc, c) => acc + (c.plan?.price || 0), 0);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await saasService.getGlobalMapData();
                setProjects(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        if (!loading && projects.length > 0) {
            renderGrowthChart();
            renderDensityChart();
        }
    }, [loading, projects, theme]);

    const renderGrowthChart = () => {
        if (!growthChartRef.current) return;
        const svg = d3.select(growthChartRef.current);
        svg.selectAll("*").remove();

        const width = growthChartRef.current.clientWidth;
        const height = growthChartRef.current.clientHeight;
        const margin = { top: 20, right: 30, bottom: 30, left: 40 };

        // Process Data: Group by Month
        const projectsByDate = d3.rollups(
            projects,
            v => v.length,
            d => new Date(d.createdAt).toISOString().slice(0, 7) // YYYY-MM
        ).sort((a, b) => a[0].localeCompare(b[0]));

        // Fill gaps if needed, simplfied for now
        const data = projectsByDate.map(([date, count]) => ({ date: new Date(date), count }));

        const x = d3.scaleTime()
            .domain(d3.extent(data, d => d.date) as [Date, Date])
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count) || 0])
            .nice()
            .range([height - margin.bottom, margin.top]);

        // Line
        const line = d3.line<any>()
            .x(d => x(d.date))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX);

        // Draw Axes
        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0))
            .attr("color", theme === 'dark' ? '#94a3b8' : '#64748b');

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(5))
            .attr("color", theme === 'dark' ? '#94a3b8' : '#64748b')
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll(".tick line").clone()
                .attr("x2", width - margin.left - margin.right)
                .attr("stroke-opacity", 0.1));

        // Draw Line
        svg.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", "#6366f1") // Indigo 500
            .attr("stroke-width", 2)
            .attr("d", line);

        // Add dots
        svg.selectAll("circle")
            .data(data)
            .join("circle")
            .attr("cx", d => x(d.date))
            .attr("cy", d => y(d.count))
            .attr("r", 4)
            .attr("fill", "#6366f1")
            .attr("stroke", theme === 'dark' ? '#0f172a' : '#fff')
            .attr("stroke-width", 2);
    };

    const renderDensityChart = () => {
        if (!densityChartRef.current) return;
        const svg = d3.select(densityChartRef.current);
        svg.selectAll("*").remove();

        const width = densityChartRef.current.clientWidth;
        const height = densityChartRef.current.clientHeight;
        const margin = { top: 20, right: 30, bottom: 30, left: 100 };

        // Process Data: Top 5 Companies
        const companyCounts = d3.rollups(
            projects,
            v => v.length,
            d => d.company?.name || 'Unknown'
        )
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Start with Top 5

        const x = d3.scaleLinear()
            .domain([0, d3.max(companyCounts, d => d[1]) || 0])
            .nice()
            .range([margin.left, width - margin.right]);

        const y = d3.scaleBand()
            .domain(companyCounts.map(d => d[0]))
            .range([margin.top, height - margin.bottom])
            .padding(0.3);

        // Draw Axes
        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(5))
            .attr("color", theme === 'dark' ? '#94a3b8' : '#64748b');

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y))
            .attr("color", theme === 'dark' ? '#94a3b8' : '#64748b')
            .call(g => g.select(".domain").remove());

        // Draw Bars
        svg.selectAll("rect")
            .data(companyCounts)
            .join("rect")
            .attr("x", margin.left)
            .attr("y", d => y(d[0])!)
            .attr("width", d => x(d[1]) - margin.left)
            .attr("height", y.bandwidth())
            .attr("fill", "#10b981") // Emerald 500
            .attr("rx", 4);

        // Add Labels Inside Bars (if wide enough)
        svg.selectAll(".label")
            .data(companyCounts)
            .join("text")
            .filter(d => x(d[1]) - margin.left > 20)
            .attr("x", d => x(d[1]) - 5)
            .attr("y", d => y(d[0])! + y.bandwidth() / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .text(d => d[1])
            .attr("fill", "#fff")
            .attr("font-size", "10px")
            .attr("font-weight", "bold");
    };

    if (loading) return <div className="h-64 flex items-center justify-center text-slate-400">Loading map data...</div>;

    return (
        <div className="space-y-6">
            {/* Infrastructure KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                    <p className="text-indigo-100 text-sm font-medium mb-1">Total Infrastructure</p>
                    <h3 className="text-3xl font-bold flex items-baseline gap-2">
                        {totalCTOs} <span className="text-sm opacity-70">CTOs</span>
                    </h3>
                    <div className="mt-2 text-xs text-indigo-100 flex items-center gap-1">
                        Managed across {companies.length} companies
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Global POPs</p>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                        {totalPOPs}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Points of Presence</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Monthly Revenue</p>
                    <h3 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                        ${totalRevenue.toFixed(2)}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Est. based on plans</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Plan Distribution Chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Plan Distribution</h3>
                    <div className="h-64 w-full">
                        <svg ref={plansChartRef} width="100%" height="100%"></svg>
                    </div>
                </div>

                {/* Growth Chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Network Growth (Projects)</h3>
                    <div className="h-64 w-full">
                        <svg ref={growthChartRef} width="100%" height="100%"></svg>
                    </div>
                </div>

                {/* Density Chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Top Companies</h3>
                    <div className="h-64 w-full">
                        <svg ref={densityChartRef} width="100%" height="100%"></svg>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold text-lg">Global Project Distribution</h3>
                    <p className="text-sm text-slate-500">Geographic spread of all active projects.</p>
                </div>
                <div className="h-[500px] w-full relative z-0">
                    <MapContainer center={[-23.5505, -46.6333]} zoom={4} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {projects.map(p => (
                            <Marker key={p.id} position={[p.centerLat, p.centerLng]}>
                                <Popup>
                                    <div className="text-sm">
                                        <strong className="block text-slate-900">{p.name}</strong>
                                        <span className="text-slate-500">{p.company?.name || 'No Company'}</span>
                                        <span className="block text-xs text-slate-400 mt-1">
                                            {new Date(p.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};
