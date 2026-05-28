// Regras de complexidade de senha — fonte única usada pelos formulários do front
// (ChangePasswordModal, RegisterPage). Mantém o que o backend valida em
// server/src/lib/passwordPolicy.ts. Quando uma regra mudar, atualize os dois
// lugares (ou suba pra shared/ no futuro).

export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordRule {
    label: string;
    test: (pwd: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
    { label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
    { label: 'Pelo menos uma letra', test: (p) => /[a-zA-Z]/.test(p) },
    { label: 'Pelo menos um número', test: (p) => /\d/.test(p) },
];

export function isPasswordValid(password: string): boolean {
    return PASSWORD_RULES.every(r => r.test(password));
}
