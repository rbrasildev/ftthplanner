/**
 * parseFloat tolerante ao locale pt-BR (vírgula como separador decimal).
 *
 * `parseFloat("0,2")` em JS devolve 0 — comportamento que silenciosamente
 * salvava 0 dB em campos de atenuação quando o usuário digitava com vírgula.
 * Use este helper sempre que receber input numérico de um <input> de texto.
 *
 * Aceita: number, string com `.` ou `,`, undefined/null/empty.
 * Retorna: number (NaN cai pro fallback informado, default 0).
 */
export function parseFloatLocale(value: unknown, fallback = 0): number {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    const normalized = String(value).replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
}
