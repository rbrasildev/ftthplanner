// Política de senha única do app. Use isto em qualquer endpoint que aceita
// senha do usuário — assim front e back validam pelas mesmas regras e a
// mensagem de erro é uniforme.

export interface PasswordValidationResult {
    ok: boolean;
    error?: string;
}

export const PASSWORD_MIN_LENGTH = 8;

export function validatePassword(password: unknown): PasswordValidationResult {
    if (typeof password !== 'string') {
        return { ok: false, error: 'Formato de senha inválido.' };
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
        return { ok: false, error: `A senha precisa ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.` };
    }
    if (!/[a-zA-Z]/.test(password)) {
        return { ok: false, error: 'A senha precisa ter ao menos uma letra.' };
    }
    if (!/\d/.test(password)) {
        return { ok: false, error: 'A senha precisa ter ao menos um número.' };
    }
    return { ok: true };
}
