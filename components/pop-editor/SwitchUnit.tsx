import React from 'react';
import { Pencil, Trash2, Network, Radio, HardDrive, Cpu } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { Button } from '../common/Button';
import type { ActiveEquipmentType, FiberConnection, SwitchData, SwitchPort } from '../../types';
import type { LedState, PortLedStates } from '../../utils/switchFiber';

const TYPE_ICON: Record<ActiveEquipmentType, any> = {
    SWITCH: Network,
    ROUTER: Radio,
    SERVER: HardDrive,
    OTHER: Cpu,
};
const TYPE_LABEL: Record<ActiveEquipmentType, string> = {
    SWITCH: 'SWITCH',
    ROUTER: 'ROUTER',
    SERVER: 'SERVER',
    OTHER: 'ATIVO',
};
const TYPE_SFP_LABEL: Record<ActiveEquipmentType, string> = {
    SWITCH: 'SFP',
    ROUTER: 'WAN',
    SERVER: 'NIC',
    OTHER: 'SFP',
};

interface SwitchUnitProps {
    sw: SwitchData;
    position: { x: number; y: number };
    width: number;
    connections: FiberConnection[];
    hoveredPortId: string | null;
    /** Estados TX/RX dos LEDs por porta — calculado pelo parent com peer tracing. */
    ledStates?: Map<string, PortLedStates>;
    onDragStart: (e: React.MouseEvent, id: string) => void;
    onEdit: (e: React.MouseEvent, sw: SwitchData) => void;
    onDelete: (e: React.MouseEvent, sw: SwitchData) => void;
    onPortClick?: (e: React.MouseEvent, portId: string) => void;
    onPortHover?: (portId: string | null) => void;
    getPortConnectionInfo?: (portId: string) => string | undefined;
}

// Convenção de cores dos LEDs (cada lado independente, espelha switch real):
//   TX âmbar sólido        → 'on'   (alocação OK + path OK)
//   TX âmbar fraco         → 'idle' (GBIC instalado mas alocação/path incompleto — ajuste necessário)
//   TX cinza               → 'off'  (sem GBIC)
//   RX verde piscando      → 'on'   (sinal recebido OK)
//   RX âmbar piscando      → 'warn' (sinal marginal)
//   RX vermelho sólido     → 'fail' (sinal abaixo da sensibilidade)
//   RX cinza               → 'idle' / 'off' (sem peer ou path incompleto)
const TX_LED_AMBER = '#eab308';
const TX_LED_AMBER_DIM = '#854d0e';
const RX_LED_GREEN = '#22c55e';
const RX_LED_WARN = '#eab308';
const RX_LED_FAIL = '#ef4444';
const LED_OFF = '#3f4451';

// Paridade visual com OLTUnit/DIOUnit (26×26).
const PORT_CELL = 26;
const PORTS_PER_ROW = 12;

export const SwitchUnit: React.FC<SwitchUnitProps> = ({
    sw,
    position,
    width,
    connections,
    hoveredPortId,
    ledStates,
    onDragStart,
    onEdit,
    onDelete,
    onPortClick,
    onPortHover,
    getPortConnectionInfo,
}) => {
    const { t } = useLanguage();

    // Mapa de FiberConnection por id de porta do switch (usado pra mostrar "connected").
    const portConnectionsMap = React.useMemo(() => {
        const map = new Map<string, FiberConnection>();
        connections.forEach(c => {
            map.set(c.sourceId, c);
            map.set(c.targetId, c);
        });
        return map;
    }, [connections]);

    const labelW = 44;
    const pad = 24;
    const rowPorts = Math.min(PORTS_PER_ROW, Math.max(sw.ports.length, 4));
    const dynamicWidth = Math.max(width, labelW + pad + rowPorts * (PORT_CELL + 2));

    const rows: SwitchPort[][] = [];
    for (let i = 0; i < sw.ports.length; i += PORTS_PER_ROW) {
        rows.push(sw.ports.slice(i, i + PORTS_PER_ROW));
    }

    const activeType: ActiveEquipmentType = sw.type ?? 'SWITCH';
    const HeaderIcon = TYPE_ICON[activeType];
    const typeLabel = TYPE_LABEL[activeType];
    const sfpLabel = TYPE_SFP_LABEL[activeType];

    return (
        <div
            id={sw.id}
            style={{ transform: `translate(${position.x}px, ${position.y}px)`, width: dynamicWidth }}
            className="absolute z-20 flex flex-col group clickable-element select-none"
        >
            {/* Chassis */}
            <div className="bg-[#1a1d23] rounded-lg shadow-xl overflow-hidden border border-slate-700/50 ring-1 ring-black/20">

                {/* Header */}
                <div
                    className="h-8 bg-[#22262e] border-b border-slate-700/50 px-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => onDragStart(e, sw.id)}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_4px_#10b981]" />
                        <HeaderIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-300 tracking-wide">{sw.name}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{sw.ports.length}P</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={(e) => onEdit(e, sw)} className="h-6 w-6 text-slate-500 hover:text-emerald-400" title={t('edit') || 'Editar'}>
                            <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => onDelete(e, sw)} className="h-6 w-6 text-slate-500 hover:text-rose-400" title={t('delete') || 'Excluir'}>
                            <Trash2 className="w-3 h-3" />
                        </Button>
                    </div>
                </div>

                {/* Ports rows */}
                <div className="p-1.5 space-y-1">
                    {rows.length === 0 && (
                        <div className="h-7 flex items-center justify-center text-[8px] text-slate-600 tracking-[0.2em] uppercase">
                            {t('slot_empty') || 'Sem portas'}
                        </div>
                    )}
                    {rows.map((rowPorts, rIdx) => (
                        <div key={rIdx} className="flex items-center bg-[#2a2e38] rounded border border-slate-600/30 px-1 py-1 gap-1">
                            <div className="w-8 shrink-0 text-[8px] font-mono font-bold text-emerald-400 text-center">
                                {sfpLabel}{rows.length > 1 ? rIdx + 1 : ''}
                            </div>
                            <div className="w-px h-4 bg-slate-600/50 shrink-0" />
                            <div className="flex flex-wrap gap-[2px]">
                                {rowPorts.map((port, pIdx) => {
                                    const globalIdx = rIdx * PORTS_PER_ROW + pIdx;
                                    const isConnected = portConnectionsMap.has(port.id);
                                    const hasGbic = !!port.gbic;
                                    const isHovered = hoveredPortId === port.id;
                                    const isBidi = port.gbic?.transmissao === 'bidi';
                                    const connInfo = isConnected && getPortConnectionInfo
                                        ? getPortConnectionInfo(port.id) : undefined;

                                    const led = ledStates?.get(port.id) ?? { tx: 'off' as LedState, rx: 'off' as LedState };

                                    const title = (() => {
                                        const label = port.label || `P${globalIdx + 1}`;
                                        const parts: string[] = [label];
                                        if (port.gbic) {
                                            parts.push(`${port.gbic.tipo} ${isBidi ? 'BiDi' : 'Duplex'}`);
                                        }
                                        if (connInfo) parts.push(`→ ${connInfo}`);
                                        else if (isConnected) parts.push('→ DIO');
                                        else if (hasGbic) {
                                            // GBIC mas tx='idle' = sem alocação; deixar a dica explícita
                                            // pra usuário entender que falta configurar (em vez de "Livre"
                                            // genérico que não diz o que fazer).
                                            parts.push(led.tx === 'idle' ? 'sem alocação — abra o editor' : (t('available') || 'disponível'));
                                        }
                                        else parts.push('sem GBIC');
                                        if (hasGbic) {
                                            parts.push(`TX:${led.tx.toUpperCase()}`);
                                            parts.push(`RX:${led.rx.toUpperCase()}`);
                                        }
                                        return parts.join(' · ');
                                    })();

                                    return (
                                        <div
                                            key={port.id}
                                            id={port.id}
                                            title={title}
                                            onMouseDown={(e) => onPortClick?.(e, port.id)}
                                            onMouseEnter={() => onPortHover?.(port.id)}
                                            onMouseLeave={() => onPortHover?.(null)}
                                            className={`
                                                relative w-[26px] h-[26px] shrink-0 rounded-sm cursor-pointer flex items-center justify-center text-[7px] font-mono font-bold transition-all
                                                ${isHovered ? 'scale-110 z-10 brightness-125' : ''}
                                            `}
                                            style={{
                                                // Mantém fundo escuro mesmo conectado — quem comunica
                                                // o link UP/DOWN são os LEDs (verde piscando + amarelo).
                                                // Cor verde no fundo "engolia" o LED verde, dando impressão
                                                // que ele não estava aceso.
                                                backgroundColor: hasGbic ? '#1e2028' : '#15171c',
                                                border: `1px solid ${isConnected ? '#10b981' : hasGbic ? '#475569' : '#3f4451'}`,
                                                color: hasGbic ? '#e2e8f0' : '#6b7280',
                                                boxShadow: isConnected ? '0 0 4px rgba(16,185,129,0.35)' : 'none',
                                            }}
                                        >
                                            {globalIdx + 1}
                                            {/* Cada LED reflete seu próprio estado. TX âmbar fraco
                                                quando idle dá pista visual de que falta configuração
                                                (em vez de cinza total que parece "porta morta"). */}
                                            {hasGbic && (() => {
                                                const txColor =
                                                    led.tx === 'on' ? TX_LED_AMBER
                                                    : led.tx === 'idle' ? TX_LED_AMBER_DIM
                                                    : LED_OFF;
                                                const rxColor =
                                                    led.rx === 'on' ? RX_LED_GREEN
                                                    : led.rx === 'warn' ? RX_LED_WARN
                                                    : led.rx === 'fail' ? RX_LED_FAIL
                                                    : LED_OFF;
                                                const txGlow = led.tx === 'on';
                                                const rxPulse = led.rx === 'on' || led.rx === 'warn';
                                                const rxGlow = rxPulse || led.rx === 'fail';
                                                return (
                                                    <div className="absolute bottom-0.5 left-0 right-0 flex items-center justify-center gap-[3px] pointer-events-none">
                                                        <span
                                                            title={`TX ${led.tx.toUpperCase()}`}
                                                            className="w-1.5 h-1.5 rounded-full"
                                                            style={{
                                                                backgroundColor: txColor,
                                                                boxShadow: txGlow ? `0 0 3px ${TX_LED_AMBER}` : undefined,
                                                            }}
                                                        />
                                                        <span
                                                            title={`RX ${led.rx.toUpperCase()}`}
                                                            className={`w-1.5 h-1.5 rounded-full ${rxPulse ? 'animate-pulse' : ''}`}
                                                            style={{
                                                                backgroundColor: rxColor,
                                                                boxShadow: rxGlow ? `0 0 3px ${rxColor}` : undefined,
                                                            }}
                                                        />
                                                    </div>
                                                );
                                            })()}
                                            {/* BiDi corner marker */}
                                            {hasGbic && isBidi && (
                                                <div
                                                    className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 pointer-events-none"
                                                    title="BiDi"
                                                />
                                            )}
                                            {/* Duplex corner marker */}
                                            {hasGbic && !isBidi && (
                                                <div
                                                    className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 pointer-events-none"
                                                    title="Duplex"
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom bar */}
                <div className="h-5 bg-[#15171c] border-t border-slate-700/30 px-3 flex justify-between items-center text-[8px] text-slate-500 font-mono select-none">
                    <span>{sw.ports.length} {t('ports') || 'portas'}</span>
                    <span className="uppercase tracking-wider text-slate-600">{typeLabel}</span>
                </div>
            </div>
        </div>
    );
};
