// Gerenciamento do código de indicação no client.
//
// Fluxo:
// 1. Visitante chega via ?ref=ABC123 → captureReferralFromUrl() salva no
//    localStorage com TTL de 7 dias + dispara POST /api/referrals/visit/ABC123.
// 2. Ao se cadastrar, getStoredReferralCode() retorna o código pra incluir
//    no payload do register.
// 3. Após registro bem-sucedido, clearReferralCode() limpa pra evitar
//    atribuição duplicada se a mesma máquina cadastrar outra conta.
//
// Atribuição é **first-touch**: se já tem código salvo, NÃO sobrescreve com
// um código novo da URL. Quem chegou primeiro fica.

import { registerReferralVisit } from '../services/saasService';

const STORAGE_KEY = 'ftth_referral_code';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

interface StoredRef {
    code: string;
    capturedAt: number;
}

export function getStoredReferralCode(): string | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredRef;
        if (!parsed.code || typeof parsed.capturedAt !== 'number') return null;
        if (Date.now() - parsed.capturedAt > TTL_MS) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return parsed.code;
    } catch {
        return null;
    }
}

function setStoredReferralCode(code: string) {
    try {
        const payload: StoredRef = { code, capturedAt: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // localStorage indisponível (privacy mode) — ignora silenciosamente.
    }
}

export function clearReferralCode() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch { /* noop */ }
}

// Lê ?ref= da URL atual e persiste. First-touch: não sobrescreve código existente.
// Também dispara o registro de visita no backend (silent fail).
// Idempotente — pode ser chamado em todo mount.
export function captureReferralFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (!ref) return;

        const code = ref.trim().toUpperCase();
        if (!/^[A-Z0-9]{4,16}$/.test(code)) return; // formato suspeito, ignora

        // Visita registrada sempre — mesmo que o code já estivesse salvo,
        // a abertura do link conta como engajamento.
        registerReferralVisit(code);

        // First-touch: só salva se ainda não tem código guardado.
        if (!getStoredReferralCode()) {
            setStoredReferralCode(code);
        }
    } catch { /* noop */ }
}
