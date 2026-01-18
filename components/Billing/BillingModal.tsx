import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import { X, Check, Loader2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import api from '../../services/api';

// Initialize Stripe outside of component to avoid recreating object on renders
// Initialize Stripe
const stripeKey = (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY;
if (!stripeKey) console.error("Missing VITE_STRIPE_PUBLISHABLE_KEY");
const stripePromise = loadStripe(stripeKey || '');

interface BillingModalProps {
    isOpen: boolean;
    onClose: () => void;
    planId: string;
    companyId: string;
    planName: string;
    price: number;
    billingEmail: string; // Should be passed or fetched
}

const CheckoutForm = ({ onSuccess, onError }: { onSuccess: () => void, onError: (msg: string) => void }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) return;

        setIsLoading(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Return URL is required, but if we do redirect: 'if_required', it might not redirect.
                // For 'payment_behavior: default_incomplete' in subscription, confirmPayment triggers the intent.
                return_url: window.location.origin + '/billing/success',
            },
            redirect: 'if_required',
        });

        if (error) {
            setMessage(error.message || 'Erro desconhecido');
            onError(error.message || 'Erro desconhecido');
            setIsLoading(false);
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            setMessage('Pagamento realizado com sucesso!');
            onSuccess();
            setIsLoading(false); // actually we might close modal here
        } else {
            // Unexpected state
            onSuccess(); // Assume success if no error and no redirect (e.g. trial)
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement />
            {message && <div className="text-red-500 text-sm">{message}</div>}
            <button
                disabled={isLoading || !stripe || !elements}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 flex justify-center items-center gap-2"
            >
                {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Confirmar Assinatura'}
            </button>
        </form>
    );
};

export const BillingModal: React.FC<BillingModalProps> = ({ isOpen, onClose, planId, companyId, planName, price, billingEmail }) => {
    const { theme } = useTheme();
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [loadingSecret, setLoadingSecret] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false); // New state for backend verification

    // Fetch Client Secret (create subscription) when modal opens
    useEffect(() => {
        if (isOpen && planId && companyId) {
            setLoadingSecret(true);
            setError(null);

            // Call Backend to create intent
            api.post('/billing/create-subscription', {
                companyId,
                priceId: planId,
                email: billingEmail
            })
                .then(response => {
                    const data = response.data;
                    if (data.error) throw new Error(data.error);
                    if (data.clientSecret) {
                        setClientSecret(data.clientSecret);
                    } else if (data.status === 'active' || data.status === 'trialing') {
                        setSuccess(true);
                    } else {
                        throw new Error(`Status não tratado: ${data.status} (Sem segredo de pagamento)`);
                    }
                })
                .catch((err: any) => {
                    console.error("Billing Error:", err);
                    let msg = 'Falha ao iniciar pagamento.';
                    if (err.response?.data?.details || err.response?.data?.error) {
                        msg = `Erro: ${err.response.data.details || err.response.data.error}`;
                    } else if (err.message) {
                        msg += ` ${err.message}`;
                    }
                    setError(msg);
                })
                .finally(() => setLoadingSecret(false));
        }
    }, [isOpen, planId, companyId]);

    // Polling function to verify subscription
    const verifySubscriptionUpdate = async () => {
        setIsVerifying(true);
        let attempts = 0;
        const maxAttempts = 10; // 20 seconds total

        const poll = async () => {
            try {
                const res = await api.get('/auth/me');
                const user = res.data.user;
                // Check if plan matches or subscription is active
                const isPlanUpdated = user.company?.planId === planId || user.company?.plan?.id === planId; // Depends on how planId matches
                // OR check active/trialing status if we don't have exact plan ID match handy (sometimes prices differ)
                const isActive = ['active', 'trialing'].includes(user.company?.subscription?.status || '');

                // If we upgraded, we expect active status.
                if (isActive) {
                    setIsVerifying(false);
                    setError(null); // Clear any previous errors
                    setSuccess(true);
                    return;
                }
            } catch (e) {
                console.warn("Verification poll failed", e);
            }

            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(poll, 2000);
            } else {
                setIsVerifying(false);
                setError(null); // Clear errors even if timeout (assume optimistic success for UX)
                setSuccess(true); // Show success anyway eventually, user can refresh if needed.
                // Optionally show a warning "Activation delayed"
            }
        };

        setTimeout(poll, 2000); // Start polling after 2s
    };


    if (!isOpen) return null;

    const appearance = {
        theme: theme === 'dark' ? 'night' : 'stripe',
        variables: {
            colorPrimary: '#0ea5e9',
            fontFamily: 'Inter, system-ui, sans-serif',
            borderRadius: '12px',
        }
    };

    const options = {
        clientSecret,
        appearance: appearance as any,
    };

    return (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            {/* Added min-h and flex structure to prevent layout jumps */}
            <div className={`w-full max-w-lg p-0 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 flex flex-col 
                ${theme === 'dark' ? 'bg-slate-900 text-white border border-slate-800' : 'bg-white text-gray-900 border border-slate-100'}`}>

                {/* Header Area */}
                <div className={`px-8 py-6 border-b ${theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'} flex justify-between items-center`}>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
                            <h2 className="text-xl font-bold tracking-tight">Assinar {planName}</h2>
                        </div>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-2xl font-bold text-sky-500">R$ {price.toFixed(2)}</span>
                            <span className="text-sm opacity-60">/ mês</span>
                        </div>
                    </div>
                    {!success && !isVerifying && (
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Content Area - Fixed min-height to prevent jitter */}
                <div className="p-8 min-h-[300px] flex flex-col justify-center relative">

                    {error && (
                        <div className="absolute top-4 left-8 right-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm flex gap-3 items-start animate-in slide-in-from-top-2">
                            <div className="p-1 bg-red-100 dark:bg-red-800 rounded-full shrink-0">
                                <X className="w-3 h-3" />
                            </div>
                            <span>{error}</span>
                        </div>
                    )}

                    {success ? (
                        <div className="flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
                            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-emerald-50 dark:ring-emerald-500/5">
                                <Check className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h2 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white">Assinatura Ativa!</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs mx-auto leading-relaxed">
                                Seu plano foi atualizado com sucesso. Aproveite seus novos recursos.
                            </p>
                            <button
                                onClick={() => {
                                    onClose();
                                    window.location.reload();
                                }}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-600/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Continuar
                            </button>
                        </div>
                    ) : isVerifying ? (
                        <div className="flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
                            <Loader2 className="w-16 h-16 animate-spin text-sky-500 mb-6" />
                            <h3 className="text-xl font-bold mb-2">Verificando Pagamento...</h3>
                            <p className="text-slate-500 dark:text-slate-400">Aguarde enquanto confirmamos sua ativação.</p>
                        </div>
                    ) : loadingSecret ? (
                        <div className="flex flex-col items-center justify-center gap-6 animate-pulse">
                            <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800" />
                            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                            <div className="space-y-3 w-full max-w-xs">
                                <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-lg" />
                                <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-lg" />
                            </div>
                        </div>
                    ) : clientSecret ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Elements options={options} stripe={stripePromise}>
                                <CheckoutForm
                                    onSuccess={verifySubscriptionUpdate}
                                    onError={(msg) => setError(msg)}
                                />
                            </Elements>
                        </div>
                    ) : (
                        !error && <div className="text-center py-8 text-slate-500">Inicializando sistema de pagamento...</div>
                    )}
                </div>

                {/* Footer / Trust Badge */}
                {!success && !isVerifying && (
                    <div className="px-8 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        Ambiente seguro criptografado de ponta a ponta
                    </div>
                )}
            </div>
        </div>
    );
};
