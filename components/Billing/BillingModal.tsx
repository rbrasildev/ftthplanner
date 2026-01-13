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

    // Fetch Client Secret (create subscription) when modal opens
    useEffect(() => {
        if (isOpen && planId && companyId) {
            setLoadingSecret(true);
            setError(null);

            // Call Backend to create intent
            // Use api.post to leverage base URL configuration
            api.post('/billing/create-subscription', {
                companyId,
                priceId: planId, // Assuming planId passed is actually the Stripe Price ID for now, or backend maps it
                email: billingEmail
            })
                .then(response => {
                    const data = response.data;
                    if (data.error) throw new Error(data.error);
                    if (data.clientSecret) {
                        setClientSecret(data.clientSecret);
                    } else if (data.status === 'active' || data.status === 'trialing') {
                        // Already active or trial (no payment needed yet)
                        setSuccess(true);
                    } else {
                        throw new Error(`Status não tratado: ${data.status} (Sem segredo de pagamento)`);
                    }
                })
                .catch((err: any) => {
                    console.error("Billing Error:", err);
                    let msg = 'Falha ao iniciar pagamento.';

                    if (err.response && err.response.data) {
                        const backendError = err.response.data;
                        const detailedMsg = backendError.details || backendError.error;
                        if (detailedMsg) {
                            msg = `Erro: ${detailedMsg}`;
                        }
                    } else if (err.message) {
                        msg += ` ${err.message}`;
                    }
                    setError(msg);
                })
                .finally(() => setLoadingSecret(false));
        }
    }, [isOpen, planId, companyId]);

    if (!isOpen) return null;

    const appearance = {
        theme: theme === 'dark' ? 'night' : 'stripe',
    };

    // Options for Elements
    const options = {
        clientSecret,
        appearance: appearance as any,
    };

    return (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl transition-all ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}`}>

                {success ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6">
                            <Check className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-slate-800 dark:text-white">Pagamento Confirmado!</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-8">
                            Sua assinatura foi atualizada com sucesso. Você já pode aproveitar todos os recursos do seu novo plano.
                        </p>
                        <button
                            onClick={() => {
                                onClose();
                                window.location.reload();
                            }}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-emerald-600/20 transition-all transform hover:scale-105 active:scale-95"
                        >
                            Continuar
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold">Assinar {planName}</h2>
                                <p className="text-sm opacity-70 mt-1">Total: R$ {price.toFixed(2)} / mês</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 text-sm flex gap-3 items-start">
                                <div className="p-1 bg-red-100 dark:bg-red-800 rounded-full shrink-0">
                                    <X className="w-3 h-3" />
                                </div>
                                <span>{error}</span>
                            </div>
                        )}

                        {loadingSecret ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-4">
                                <Loader2 className="w-10 h-10 animate-spin text-sky-500" />
                                <p className="text-sm font-medium text-slate-500">Iniciando pagamento seguro...</p>
                            </div>
                        ) : clientSecret ? (
                            <Elements options={options} stripe={stripePromise}>
                                <CheckoutForm
                                    onSuccess={() => setSuccess(true)}
                                    onError={(msg) => setError(msg)}
                                />
                            </Elements>
                        ) : (
                            !error && <div className="text-center py-8 text-slate-500">Inicializando...</div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
