import React from 'react';

interface IconProps {
    className?: string;
    size?: number;
}

/**
 * CTO (Caixa Terminal Óptica) — Optical Terminal Box.
 * Caixa retangular montada em poste com portas de fibra visíveis no lado.
 * Visualmente: corpo retangular com tampa indicada no topo e 2 portas de
 * saída (drop) na lateral direita.
 *
 * Desenho preenche todo o viewBox 24x24 pra manter paridade visual com os
 * ícones Lucide do resto do menu (que tipicamente vão de ~2 a ~22).
 */
export const CTOIcon: React.FC<IconProps> = ({ className, size }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        {/* Corpo da caixa — preenche quase toda a largura */}
        <rect x="2" y="4" width="17" height="16" rx="1.5" />
        {/* Linha da tampa no topo */}
        <line x1="2" y1="9" x2="19" y2="9" />
        {/* Portas de saída drop na lateral direita */}
        <circle cx="22" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="22" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
        {/* Conectores entre caixa e portas */}
        <line x1="19" y1="12.5" x2="20.8" y2="12.5" />
        <line x1="19" y1="16.5" x2="20.8" y2="16.5" />
    </svg>
);

/**
 * CEO (Caixa de Emenda Óptica) — Optical Splice Closure.
 * Cápsula cilíndrica com domo no topo e cabos entrando pela base.
 * Visualmente: cápsula vertical (parecida com bala) com cabos saindo da base.
 */
export const CEOIcon: React.FC<IconProps> = ({ className, size }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        {/* Corpo: cápsula com domo arredondado no topo. Vai de y=2 a y=20 e
            de x=5 a x=19 — preenche praticamente todo o viewBox. */}
        <path d="M5 9 Q5 2 12 2 Q19 2 19 9 L19 20 L5 20 Z" />
        {/* Flange / linha divisória do domo */}
        <line x1="5" y1="9" x2="19" y2="9" />
        {/* Cabos entrando pela base */}
        <line x1="9" y1="20" x2="9" y2="23" />
        <line x1="15" y1="20" x2="15" y2="23" />
    </svg>
);
