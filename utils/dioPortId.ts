// Shared helpers for inline DIO port IDs.
//
// A DIO inline port id has the shape `${dioId}-port-${i}-(in|out)`, where
// `dioId` is itself `dio-${Date.now()}`. Centralizing the parser/builder here
// keeps the format change-safe — any tweak ripples through one file instead of
// the half-dozen sites that previously inlined the same regex.

export type DIOPortSide = 'in' | 'out';

export interface ParsedDIOPortId {
    dioId: string;
    portIndex: number;
    side: DIOPortSide;
}

const DIO_ID_PREFIX = 'dio-';
const DIO_PORT_ID_REGEX = /^(dio-\d+)-port-(\d+)-(in|out)$/;

/** Cheap prefix check used to short-circuit hot paths before running the regex. */
export function isDIOPortIdLike(id: string): boolean {
    return id.startsWith(DIO_ID_PREFIX);
}

/** Returns parsed parts when `id` matches the inline DIO port format, else `null`. */
export function parseDIOPortId(id: string): ParsedDIOPortId | null {
    if (!isDIOPortIdLike(id)) return null;
    const m = DIO_PORT_ID_REGEX.exec(id);
    if (!m) return null;
    return {
        dioId: m[1],
        portIndex: parseInt(m[2], 10),
        side: m[3] as DIOPortSide,
    };
}

export function makeDIOPortId(dioId: string, portIndex: number, side: DIOPortSide): string {
    return `${dioId}-port-${portIndex}-${side}`;
}

export function flipDIOPortSide(side: DIOPortSide): DIOPortSide {
    return side === 'in' ? 'out' : 'in';
}
