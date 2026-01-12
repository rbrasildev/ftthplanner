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
                        onClose();
                        alert(`Assinatura ativa! Status: ${data.status}`);
                    }
                })
                .catch(err => {
                    console.error(err);
                    setError('Falha ao iniciar pagamento. ' + err.message);
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className={`w-full max-w-md p-6 rounded-lg shadow-xl ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Assinar {planName}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-4">
                    <p className="text-sm opacity-80">Total a pagar: R$ {price.toFixed(2)} / mês</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                {loadingSecret ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <p className="text-sm opacity-70">Preparando pagamento seguro...</p>
                    </div>
                ) : clientSecret ? (
                    <Elements options={options} stripe={stripePromise}>
                        <CheckoutForm
                            onSuccess={() => {
                                alert('Pagamento Confirmado!');
                                onClose();
                                window.location.reload(); // Refresh to update status
                            }}
                            onError={(msg) => setError(msg)}
                        />
                    </Elements>
                ) : (
                    !error && <div className="text-center py-4">Inicializando...</div>
                )}
            </div>
        </div>
    );
};
