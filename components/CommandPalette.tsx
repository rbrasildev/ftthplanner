import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, X, Server, Box, MapPin, User, FolderKanban, ArrowDownUp, CornerDownLeft, Command } from 'lucide-react';
import { Customer, Coordinates } from '../types';

type ResultKind = 'project' | 'pop' | 'cto' | 'customer' | 'pin';

interface CommandResult {
    id: string;
    kind: ResultKind;
    name: string;
    subtitle?: string;
    coordinates?: Coordinates;
    /** For projects */
    projectId?: string;
}

interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
    projects: Array<{ id: string; name: string }>;
    currentNetwork: {
        ctos: Array<{ id: string; name: string; coordinates: Coordinates; popId?: string | null }>;
        pops?: Array<{ id: string; name: string; coordinates: Coordinates }>;
    };
    customers: Customer[];
    onNavigate: (item: { id: string; coordinates: Coordinates; type: 'CTO' | 'POP' | 'PIN' }) => void;
    onOpenProject: (projectId: string) => void;
    onEditCustomer: (customerId: string) => void;
}

const onlyDigits = (s: string) => s.replace(/\D/g, '');

export const CommandPalette: React.FC<CommandPaletteProps> = ({
    open,
    onClose,
    projects,
    currentNetwork,
    customers,
    onNavigate,
    onOpenProject,
    onEditCustomer,
}) => {
    const [query, setQuery] = useState('');
    const [activeIdx, setActiveIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            setQuery('');
            setActiveIdx(0);
            // Foco no input no próximo tick (depois do render)
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [open]);

    const results = useMemo<CommandResult[]>(() => {
        const term = query.trim();
        if (term.length < 1) return [];

        // Coordenadas coladas: "lat, lng" ou "lat lng"
        const coordMatch = term.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
        if (coordMatch) {
            return [{
                id: 'pin',
                kind: 'pin',
                name: `${coordMatch[1]}, ${coordMatch[3]}`,
                subtitle: 'Ir para coordenadas',
                coordinates: { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[3]) },
            }];
        }

        const lower = term.toLowerCase();
        const digits = onlyDigits(term);

        const out: CommandResult[] = [];

        // Projetos
        for (const p of projects) {
            if (p.name.toLowerCase().includes(lower)) {
                out.push({ id: `proj-${p.id}`, kind: 'project', name: p.name, subtitle: 'Abrir projeto', projectId: p.id });
                if (out.length >= 30) break;
            }
        }

        // POPs
        for (const pop of currentNetwork.pops || []) {
            if (pop.name.toLowerCase().includes(lower)) {
                out.push({ id: `pop-${pop.id}`, kind: 'pop', name: pop.name, subtitle: 'POP', coordinates: pop.coordinates });
                if (out.length >= 30) break;
            }
        }

        // CTOs
        for (const cto of currentNetwork.ctos) {
            if (cto.name.toLowerCase().includes(lower)) {
                out.push({ id: `cto-${cto.id}`, kind: 'cto', name: cto.name, subtitle: 'CTO', coordinates: cto.coordinates });
                if (out.length >= 30) break;
            }
        }

        // Clientes — nome OU document (cpf/cnpj) OU telefone
        const docMatchesQuery = digits.length >= 3;
        for (const c of customers) {
            const nameHit = c.name.toLowerCase().includes(lower);
            const docHit = docMatchesQuery && c.document && onlyDigits(c.document).includes(digits);
            const phoneHit = docMatchesQuery && c.phone && onlyDigits(c.phone).includes(digits);
            if (nameHit || docHit || phoneHit) {
                const docFmt = c.document ? c.document : null;
                const sub = [docFmt, c.phone].filter(Boolean).join(' · ') || 'Cliente';
                out.push({
                    id: `cus-${c.id}`,
                    kind: 'customer',
                    name: c.name,
                    subtitle: sub,
                    coordinates: { lat: c.lat, lng: c.lng },
                });
                if (out.length >= 30) break;
            }
        }

        return out.slice(0, 30);
    }, [query, projects, currentNetwork, customers]);

    // Reset active index quando results muda
    useEffect(() => { setActiveIdx(0); }, [query]);

    const selectResult = useCallback((r: CommandResult) => {
        if (r.kind === 'project' && r.projectId) {
            onOpenProject(r.projectId);
        } else if (r.kind === 'customer' && r.coordinates) {
            // Navega no mapa e abre o modal de edição do cliente
            const customerRealId = r.id.replace(/^cus-/, '');
            onNavigate({ id: customerRealId, coordinates: r.coordinates, type: 'PIN' });
            onEditCustomer(customerRealId);
        } else if (r.coordinates) {
            const realId = r.id.replace(/^(pop|cto|pin)-?/, '');
            onNavigate({
                id: realId || r.id,
                coordinates: r.coordinates,
                type: r.kind === 'pop' ? 'POP' : r.kind === 'cto' ? 'CTO' : 'PIN',
            });
        }
        onClose();
    }, [onNavigate, onOpenProject, onEditCustomer, onClose]);

    // Keyboard navigation
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIdx(i => Math.min(i + 1, Math.max(0, results.length - 1)));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIdx(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const r = results[activeIdx];
                if (r) selectResult(r);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, results, activeIdx, selectResult, onClose]);

    // Scroll item ativo pra dentro da viewport
    useEffect(() => {
        if (!listRef.current) return;
        const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [activeIdx]);

    if (!open) return null;

    const grouped = results.reduce<Record<ResultKind, CommandResult[]>>((acc, r) => {
        (acc[r.kind] ||= []).push(r);
        return acc;
    }, {} as any);

    const groupOrder: ResultKind[] = ['pin', 'project', 'pop', 'cto', 'customer'];
    const groupTitles: Record<ResultKind, string> = {
        pin: 'Coordenadas',
        project: 'Projetos',
        pop: 'POPs',
        cto: 'CTOs',
        customer: 'Clientes',
    };
    const groupIcons: Record<ResultKind, React.ReactNode> = {
        pin: <MapPin className="w-3.5 h-3.5" />,
        project: <FolderKanban className="w-3.5 h-3.5" />,
        pop: <Server className="w-3.5 h-3.5" />,
        cto: <Box className="w-3.5 h-3.5" />,
        customer: <User className="w-3.5 h-3.5" />,
    };

    // Mapear índice plano ↔ item (pro keyboard nav)
    let flatIdx = -1;

    return (
        <div className="fixed inset-0 z-[5000] flex items-start justify-center pt-[12vh] px-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150" onMouseDown={onClose} />

            {/* Modal */}
            <div
                className="relative w-full max-w-2xl bg-white dark:bg-[#1a1d23] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-150"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700/50">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar projetos, POPs, CTOs, clientes (nome/CPF/telefone) ou colar coordenadas…"
                        className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                    />
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                        title="Fechar (Esc)"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Results */}
                <div ref={listRef} className="flex-1 overflow-y-auto py-2 min-h-0">
                    {query.trim().length < 1 ? (
                        <div className="px-4 py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                            <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
                            Comece a digitar para buscar…
                            <div className="mt-3 text-[10px] text-slate-400/70">
                                Dica: cole <span className="font-mono">-23.55, -46.63</span> pra ir direto pra coordenadas
                            </div>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="px-4 py-10 text-center text-xs text-slate-400">
                            Nenhum resultado para <span className="font-semibold text-slate-600 dark:text-slate-300">"{query}"</span>
                        </div>
                    ) : (
                        groupOrder.map(k => {
                            const items = grouped[k];
                            if (!items || items.length === 0) return null;
                            return (
                                <div key={k} className="mb-1">
                                    <div className="px-4 py-1.5 flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        {groupIcons[k]}
                                        {groupTitles[k]}
                                        <span className="text-slate-300 dark:text-slate-600">·</span>
                                        <span className="text-slate-400 dark:text-slate-500">{items.length}</span>
                                    </div>
                                    {items.map((r) => {
                                        flatIdx++;
                                        const myIdx = flatIdx;
                                        const isActive = myIdx === activeIdx;
                                        return (
                                            <button
                                                key={r.id}
                                                data-idx={myIdx}
                                                onMouseEnter={() => setActiveIdx(myIdx)}
                                                onClick={() => selectResult(r)}
                                                className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                                                    isActive
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                                }`}
                                            >
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                    r.kind === 'project' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' :
                                                    r.kind === 'pop' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' :
                                                    r.kind === 'cto' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                                                    r.kind === 'customer' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                                                    'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                                }`}>
                                                    {groupIcons[r.kind]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{r.name}</div>
                                                    {r.subtitle && (
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{r.subtitle}</div>
                                                    )}
                                                </div>
                                                {isActive && (
                                                    <CornerDownLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer com atalhos */}
                <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-[#15171c] shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><ArrowDownUp className="w-3 h-3" />navegar</span>
                        <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" />abrir</span>
                        <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-mono text-[9px]">Esc</kbd>fechar</span>
                    </div>
                    <span className="flex items-center gap-1">
                        <Command className="w-3 h-3" />K
                    </span>
                </div>
            </div>
        </div>
    );
};
