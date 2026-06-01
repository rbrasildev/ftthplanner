import React from 'react';

interface IconProps {
    className?: string;
    size?: number;
}

/**
 * CTO (Caixa Terminal Óptica) — SVG realista da caixa terminal usada em poste.
 * Cor herdada via currentColor pra combinar com o tema (claro/escuro) e com
 * os ícones lucide do resto do sistema. Opacidades variadas criam hierarquia
 * visual (corpo opaco, texturas e detalhes mais discretos).
 */
export const CTOIcon: React.FC<IconProps> = ({ className, size }) => (
    <svg
        viewBox="0 0 400 500"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <rect x="80" y="60" width="240" height="380" rx="12" fill="currentColor" opacity="0.85" stroke="currentColor" strokeWidth="2"/>
        <path d="M80 80H95M80 110H95M80 140H95M80 170H95M80 200H95M80 230H95M80 260H95M80 290H95M80 320H95M80 350H95M80 380H95M80 410H95" stroke="currentColor" opacity="0.4" strokeWidth="2"/>
        <path d="M320 80H305M320 110H305M320 140H305M320 170H305M320 200H305M320 230H305M320 260H305M320 290H305M320 320H305M320 350H305M320 380H305M320 410H305" stroke="currentColor" opacity="0.4" strokeWidth="2"/>
        <path d="M110 60V75M140 60V75M170 60V75M200 60V75M230 60V75M260 60V75M290 60V75" stroke="currentColor" opacity="0.4" strokeWidth="2"/>
        <path d="M110 440V425M140 440V425M170 440V425M200 440V425M230 440V425M260 440V425M290 440V425" stroke="currentColor" opacity="0.4" strokeWidth="2"/>
        <rect x="65" y="90" width="15" height="40" rx="2" fill="currentColor" stroke="currentColor" strokeWidth="1"/>
        <rect x="65" y="160" width="15" height="40" rx="2" fill="currentColor" stroke="currentColor" strokeWidth="1"/>
        <rect x="65" y="230" width="15" height="40" rx="2" fill="currentColor" stroke="currentColor" strokeWidth="1"/>
        <rect x="65" y="300" width="15" height="40" rx="2" fill="currentColor" stroke="currentColor" strokeWidth="1"/>
        <rect x="65" y="370" width="15" height="40" rx="2" fill="currentColor" stroke="currentColor" strokeWidth="1"/>
        <rect x="305" y="120" width="30" height="70" rx="4" fill="currentColor" opacity="0.7" stroke="currentColor" strokeWidth="2"/>
        <rect x="315" y="145" width="20" height="20" rx="2" fill="currentColor"/>
        <rect x="305" y="310" width="30" height="70" rx="4" fill="currentColor" opacity="0.7" stroke="currentColor" strokeWidth="2"/>
        <rect x="315" y="335" width="20" height="20" rx="2" fill="currentColor"/>
        <rect x="130" y="100" width="140" height="60" rx="4" fill="currentColor" opacity="0.3"/>
        <rect x="120" y="330" width="80" height="40" rx="2" stroke="currentColor" opacity="0.4" strokeWidth="1.5" fill="none"/>
        <path d="M135 360C135 345 185 345 185 360" stroke="currentColor" opacity="0.4" strokeWidth="1.5" fill="none"/>
        <path d="M250 370L230 330L270 330L250 370Z" stroke="currentColor" opacity="0.4" strokeWidth="1.5" fill="none"/>
        <circle cx="250" cy="355" r="4" fill="currentColor" opacity="0.4"/>
        <line x1="250" y1="345" x2="250" y2="350" stroke="currentColor" opacity="0.4" strokeWidth="1.5"/>
    </svg>
);

/**
 * CEO (Caixa de Emenda Óptica) — SVG realista da cúpula de emenda com cabos
 * entrando pela base. Mesmas regras de cor/opacidade do CTOIcon.
 */
export const CEOIcon: React.FC<IconProps> = ({ className, size }) => (
    <svg
        viewBox="0 0 400 600"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <path d="M100 80C100 57.9086 117.909 40 140 40H260C282.091 40 300 57.9086 300 80V450H100V80Z" fill="currentColor" opacity="0.85" stroke="currentColor" strokeWidth="2"/>
        <rect x="100" y="120" width="200" height="20" fill="currentColor" opacity="0.2"/>
        <rect x="100" y="180" width="200" height="20" fill="currentColor" opacity="0.2"/>
        <rect x="100" y="240" width="200" height="20" fill="currentColor" opacity="0.2"/>
        <rect x="100" y="300" width="200" height="20" fill="currentColor" opacity="0.2"/>
        <rect x="100" y="360" width="200" height="20" fill="currentColor" opacity="0.2"/>
        <rect x="100" y="420" width="200" height="15" fill="currentColor" opacity="0.2"/>
        <rect x="145" y="40" width="4" height="410" fill="currentColor" opacity="0.3"/>
        <rect x="198" y="40" width="4" height="410" fill="currentColor" opacity="0.3"/>
        <rect x="251" y="40" width="4" height="410" fill="currentColor" opacity="0.3"/>
        <path d="M100 150H70V200H100V150Z" fill="currentColor" opacity="0.85" stroke="currentColor" strokeWidth="2"/>
        <circle cx="85" cy="175" r="5" fill="currentColor" opacity="0.4"/>
        <path d="M100 350H70V400H100V350Z" fill="currentColor" opacity="0.85" stroke="currentColor" strokeWidth="2"/>
        <circle cx="85" cy="375" r="5" fill="currentColor" opacity="0.4"/>
        <path d="M90 450C90 444.477 94.4772 440 100 440H300C305.523 440 310 444.477 310 450V480H90V450Z" fill="currentColor" stroke="currentColor" strokeWidth="2"/>
        <rect x="90" y="460" width="220" height="5" fill="currentColor" opacity="0.6"/>
        <rect x="115" y="480" width="25" height="60" fill="currentColor" stroke="currentColor" strokeWidth="2"/>
        <rect x="150" y="480" width="25" height="80" fill="currentColor" stroke="currentColor" strokeWidth="2"/>
        <rect x="185" y="480" width="30" height="90" fill="currentColor" stroke="currentColor" strokeWidth="2"/>
        <rect x="225" y="480" width="25" height="80" fill="currentColor" stroke="currentColor" strokeWidth="2"/>
        <rect x="260" y="480" width="25" height="60" fill="currentColor" stroke="currentColor" strokeWidth="2"/>
    </svg>
);
