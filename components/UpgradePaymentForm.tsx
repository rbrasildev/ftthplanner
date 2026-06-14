import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { CreditCard, Lock, Calendar, User, ShieldCheck, Mail, AlertTriangle, Loader2, CheckCircle2, ChevronLeft, Wallet, Minus, Plus, Copy, RefreshCw } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe((import.meta as any).env.VITE_STRIPE_PUBLIC_KEY || '');

declare global {
    interface Window {
        MercadoPago: any;
        MP_DEVICE_SESSION_ID?: string; // Added for Mercado Pago security script
    }
}

interface SelectedInvoice {
    id: string;
    amount: number;
    referenceStart?: string;
    referenceEnd?: string;
    createdAt?: string;
}

interface UpgradePaymentFormProps {
    plan: {
        id: string;
        name: string;
        priceRaw: number;
        features?: string[];
    };
    onSuccess: () => void;
    onCancel: () => void;
    email?: string;
    selectedInvoice?: SelectedInvoice | null;
    remainingAfter?: { count: number; total: number } | null;
}

const formatPixCountdown = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};

const CARD_ELEMENT_OPTIONS = {
    style: {
        base: {
            color: "#32325d",
            fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
            fontSmoothing: "antialiased",
            fontSize: "16px",
            "::placeholder": {
                color: "#aab7c4",
            },
        },
        invalid: {
            color: "#fa755a",
            iconColor: "#fa755a",
        },
    },
};

const StripeCardForm = ({ plan, onSuccess, status, setStatus, priceLabel, invoiceId }: { plan: any, onSuccess: () => void, status: any, setStatus: any, priceLabel: string, invoiceId?: string }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);

    const isMountedRef = useRef(true);
    const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            timeoutsRef.current.forEach(clearTimeout);
        };
    }, []);

    const safeSetStatus = (next: any) => { if (isMountedRef.current) setStatus(next); };
    const scheduleSuccess = (ms: number) => {
        const t = setTimeout(() => {
            if (isMountedRef.current) onSuccess();
        }, ms);
        timeoutsRef.current.push(t);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) return;

        setLoading(true);
        safeSetStatus(null);

        try {
            // Request the client_secret from backend
            const { data } = await api.post('/payments/create-stripe-intent', {
                planId: plan.id,
                ...(invoiceId ? { invoiceId } : {})
            });
            const { clientSecret, subscriptionId } = data;

            // Confirm payment in browser securely
            const result = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: elements.getElement(CardElement) as any,
                }
            });

            if (result.error) {
                safeSetStatus({ type: 'error', message: result.error.message || 'Erro no pagamento' });
            } else if (result.paymentIntent?.status === 'succeeded' || result.paymentIntent?.status === 'requires_capture') {
                safeSetStatus({ type: 'success', message: 'Pagamento concluído! Ativando assinatura...' });
                // Confirm subscription on backend to activate plan immediately
                try {
                    await api.post('/payments/confirm-stripe-subscription', { subscriptionId });
                    safeSetStatus({ type: 'success', message: 'Assinatura ativada com sucesso!' });
                    scheduleSuccess(1500);
                } catch (confirmErr: any) {
                    console.error('Stripe confirm error:', confirmErr);
                    // Payment went through but confirmation failed — retry once after short delay
                    await new Promise(r => setTimeout(r, 2000));
                    try {
                        await api.post('/payments/confirm-stripe-subscription', { subscriptionId });
                        safeSetStatus({ type: 'success', message: 'Assinatura ativada com sucesso!' });
                        scheduleSuccess(1500);
                    } catch {
                        // Pagamento foi confirmado na Stripe mas ativação no backend falhou.
                        // Webhook deve finalizar em segundos. Informar usuário com honestidade.
                        safeSetStatus({
                            type: 'success',
                            message: 'Pagamento recebido. A ativação pode levar até 1 minuto — recarregue a página em instantes. Se persistir, contate o suporte.'
                        });
                    }
                }
            } else {
                safeSetStatus({ type: 'success', message: 'Assinatura criada! Processando pagamento...' });
                scheduleSuccess(2000);
            }
        } catch (err: any) {
            console.error(err);
            safeSetStatus({ type: 'error', message: err.response?.data?.error || err.message || 'Erro inesperado' });
        } finally {
            if (isMountedRef.current) setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {status && (
                <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-500/10 dark:border-red-500/20'
                    }`}>
                    {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    {status.message}
                </div>
            )}
            
            <div className="space-y-3 bg-white dark:bg-[#1a1d23] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm">
                <div className="flex items-center gap-2">
                   <CreditCard className="w-5 h-5 text-slate-400" />
                   <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Dados do Cartão</h3>
                </div>

                <div className="px-4 py-3.5 bg-[#f9fafb] dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700/30 rounded-xl relative">
                   <CardElement options={CARD_ELEMENT_OPTIONS} className="w-full" />
                </div>
            </div>

            <div className="pt-2">
                <button
                    type="submit"
                    disabled={!stripe || loading}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-3 text-lg active:scale-[0.98]"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Lock className="w-5 h-5" />
                    )}
                    {loading ? 'Processando...' : `Pagar ${priceLabel}`}
                </button>
                <p className="mt-3 text-[11px] text-slate-400 text-center leading-relaxed px-4 flex items-center justify-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    Pagamento protegido por Stripe · PCI DSS Nível 1
                </p>
            </div>
        </form>
    );
};

export const UpgradePaymentForm: React.FC<UpgradePaymentFormProps> = ({ plan, onSuccess, onCancel, email, selectedInvoice, remainingAfter }) => {
    const { t } = useLanguage();
    const [mp, setMp] = useState<any>(null);
    const [deviceId, setDeviceId] = useState<string | null>(null); // New state for deviceId
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [paymentTab, setPaymentTab] = useState<'card' | 'pix'>('card');

    // Pix State
    const [pixLoading, setPixLoading] = useState(false);
    const [pixData, setPixData] = useState<{ qr_code: string, qr_code_base64: string, invoiceId: string, expires_at: string } | null>(null);
    const [pixCopied, setPixCopied] = useState(false);
    const [pixRemainingMs, setPixRemainingMs] = useState<number>(0);
    const pixExpired = pixData !== null && pixRemainingMs <= 0;

    // Form State
    const [formData, setFormData] = useState({
        cardNumber: '',
        cardholderName: '',
        expiry: '', // Combined MM/AA
        securityCode: '',
        email: email || '',
        identificationType: 'CPF',
        identificationNumber: ''
    });

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://sdk.mercadopago.com/js/v2';
        script.async = true;
        script.onload = () => {
            const publicKey = (import.meta as any).env.VITE_MERCADOPAGO_PUBLIC_KEY;
            if (publicKey) {
                try {
                    const mpInstance = new window.MercadoPago(publicKey);
                    setMp(mpInstance);

                    // Carregar script antifraude do MP (Device Fingerprint)
                    const securityScript = document.createElement('script');
                    securityScript.src = 'https://http2.mlstatic.com/storage/security/custom-eval.js';
                    securityScript.id = 'mercadopago-security-js';
                    securityScript.setAttribute('data-session-id', Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
                    securityScript.async = true;

                    securityScript.onload = () => {
                        // O script do MP popula essa variável global
                        if (window.MP_DEVICE_SESSION_ID) {
                            setDeviceId(window.MP_DEVICE_SESSION_ID);
                        }
                    };

                    if (!document.getElementById('mercadopago-security-js')) {
                        document.body.appendChild(securityScript);
                    } else if (window.MP_DEVICE_SESSION_ID) {
                        setDeviceId(window.MP_DEVICE_SESSION_ID);
                    }

                } catch (e) {
                    console.error("Failed to initialize Mercado Pago", e);
                }
            }
        };
        document.body.appendChild(script);

        // Cleanup function
        return () => {
            const mpScript = document.getElementById('mercadopago-js');
            if (mpScript && document.body.contains(mpScript)) {
                document.body.removeChild(mpScript);
            }
            const securityScriptElement = document.getElementById('mercadopago-security-js');
            if (securityScriptElement && document.body.contains(securityScriptElement)) {
                document.body.removeChild(securityScriptElement);
            }
        };
    }, []);

    // Pix Polling Effect — stops once QR expired or payment confirmed
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (pixData?.invoiceId && !status && !pixExpired) {
            interval = setInterval(async () => {
                try {
                    const res = await api.get(`/payments/invoice/${pixData.invoiceId}/status`);
                    if (res.data.status === 'PAID') {
                        setStatus({ type: 'success', message: t('mp_pix_success') });
                        clearInterval(interval);
                        setTimeout(() => {
                            onSuccess();
                        }, 1500);
                    }
                } catch (err) {
                    console.error('Error polling invoice status', err);
                }
            }, 5000); // Poll every 5 seconds
        }
        return () => clearInterval(interval);
    }, [pixData, status, onSuccess, pixExpired, t]);

    // Pix countdown tick
    useEffect(() => {
        if (!pixData?.expires_at) { setPixRemainingMs(0); return; }
        const expiresAt = new Date(pixData.expires_at).getTime();
        const tick = () => {
            const remaining = Math.max(0, expiresAt - Date.now());
            setPixRemainingMs(remaining);
        };
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [pixData]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        // Card number formatting
        if (name === 'cardNumber') {
            const formattedValue = value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
            setFormData(prev => ({ ...prev, [name]: formattedValue.substring(0, 19) }));
            return;
        }

        // Identification formatting (CPF/CNPJ mask)
        if (name === 'identificationNumber') {
            let v = value.replace(/\D/g, '');
            if (v.length <= 11) { // CPF
                v = v.replace(/(\d{3})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            } else { // CNPJ
                v = v.replace(/^(\d{2})(\d)/, '$1.$2');
                v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
                v = v.replace(/(\d{4})(\d)/, '$1-$2');
                v = v.substring(0, 18);
            }
            const idType = value.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF';
            setFormData(prev => ({ ...prev, [name]: v, identificationType: idType }));
            return;
        }

        // Expiry date formatting (MM/AA)
        if (name === 'expiry') {
            let formattedValue = value.replace(/\D/g, '');
            if (formattedValue.length > 2) {
                formattedValue = formattedValue.substring(0, 2) + '/' + formattedValue.substring(2, 4);
            }
            setFormData(prev => ({ ...prev, [name]: formattedValue.substring(0, 5) }));
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const getPaymentMethodId = async (bin: string) => {
        if (!mp) return null;
        try {
            const response = await mp.getPaymentMethods({ bin });
            if (response.results.length > 0) {
                return response.results[0].id;
            }
        } catch (error) {
            console.error('Error fetching payment method', error);
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mp) return;

        setLoading(true);
        setStatus(null);

        try {
            const bin = formData.cardNumber.replace(/\s/g, '').substring(0, 6);
            const paymentMethodId = await getPaymentMethodId(bin);

            if (!paymentMethodId) {
                throw new Error('Não foi possível identificar a bandeira do cartão.');
            }

            const [month, year] = formData.expiry.split('/');
            if (!month || !year || month.length !== 2 || year.length !== 2) {
                throw new Error('Data de validade inválida. Use o formato MM/AA.');
            }

            const tokenResponse = await mp.createCardToken({
                cardNumber: formData.cardNumber.replace(/\s/g, ''),
                cardholderName: formData.cardholderName,
                cardExpirationMonth: month,
                cardExpirationYear: '20' + year, // Convert YY to YYYY
                securityCode: formData.securityCode,
                identification: {
                    type: formData.identificationType,
                    number: formData.identificationNumber
                }
            });

            if (!tokenResponse.id) {
                throw new Error('Falha ao gerar token do cartão. Verifique os dados.');
            }

            const nameParts = formData.cardholderName.trim().split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;
            // Use the deviceId from state, or fallback to window.MP_DEVICE_SESSION_ID if state isn't updated yet
            const currentDeviceId = deviceId || window.MP_DEVICE_SESSION_ID || '';

            // Call Backend Subscribe
            await api.post('/payments/subscribe', {
                token: tokenResponse.id,
                planId: plan.id,
                installments: 1,
                paymentMethodId: paymentMethodId,
                issuerId: tokenResponse.issuer_id, // include the issuer
                deviceId: currentDeviceId, // Anti-fraud hash
                payer: {
                    email: formData.email,
                    first_name: firstName,
                    last_name: lastName,
                    identification: {
                        type: formData.identificationType,
                        number: formData.identificationNumber
                    }
                }
            });

            setStatus({ type: 'success', message: t('mp_success') });
            setTimeout(() => {
                onSuccess();
            }, 1500);

        } catch (err: any) {
            console.error('Subscription Error:', err);
            let msg = t('mp_err_default');
            const responseMsg = err.response?.data?.message || err.response?.data?.error || err.message || '';

            if (responseMsg.includes('Unauthorized') || responseMsg === 'Unauthorized access to resource.') {
                msg = t('mp_err_unauthorized');
            } else if (responseMsg) {
                msg = responseMsg;
            }

            setStatus({ type: 'error', message: msg });
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePix = async (e: React.FormEvent) => {
        e.preventDefault();
        setPixLoading(true);
        setStatus(null);

        try {
            const res = await api.post('/payments/create_pix', {
                planId: plan.id,
                ...(selectedInvoice?.id ? { invoiceId: selectedInvoice.id } : {}),
                payer: {
                    email: formData.email,
                    first_name: formData.cardholderName || 'Cliente FTTH',
                    identification: {
                        type: formData.identificationType,
                        number: formData.identificationNumber
                    }
                }
            });

            setPixData(res.data);
            // Preservar dados do pagador — caso QR expire, usuário pode regenerar sem digitar tudo de novo.
        } catch (err: any) {
            console.error('Pix Error:', err);

            // Try to extract exact MP error to display in UI
            let msg = t('mp_pix_error') || 'Error generating Pix payment';
            const mpDetails = err.response?.data?.details;
            const errorMsg = err.response?.data?.message || err.response?.data?.error;

            if (mpDetails && typeof mpDetails === 'object') {
                if (mpDetails.message) {
                    msg = mpDetails.message;
                } else if (Array.isArray(mpDetails.cause) && mpDetails.cause.length > 0) {
                    msg = `MP Error: ${mpDetails.cause[0].description || mpDetails.cause[0].code}`;
                } else {
                    msg = JSON.stringify(mpDetails).substring(0, 100);
                }
            } else if (errorMsg) {
                if (errorMsg.includes('Unauthorized') || errorMsg === 'Unauthorized access to resource.') {
                    msg = t('mp_err_unauthorized') || 'Unauthorized';
                } else {
                    msg = String(errorMsg);
                }
            }

            setStatus({ type: 'error', message: msg });
        } finally {
            setPixLoading(false);
        }
    };

    const handleCopyPix = () => {
        if (pixData?.qr_code) {
            navigator.clipboard.writeText(pixData.qr_code);
            setPixCopied(true);
            setTimeout(() => setPixCopied(false), 2000);
        }
    };

    const inputClasses = "w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400";
    const labelClasses = "block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1";
    const iconClasses = "absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400";

    const defaultFeatures = [
        "Acesso total ao sistema de mapas",
        "Suporte técnico prioritário",
        "Exportação de arquivos KMZ/KML",
        "Infraestrutura de alta performance"
    ];
    const features = Array.from(new Set(
        plan.features && plan.features.length > 0 ? plan.features : defaultFeatures
    ));
    const chargeAmount = selectedInvoice?.amount ?? plan.priceRaw;
    const priceLabel = `R$ ${chargeAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const selectedPeriodLabel = selectedInvoice && selectedInvoice.referenceStart && selectedInvoice.referenceEnd
        ? `${new Date(selectedInvoice.referenceStart).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${new Date(selectedInvoice.referenceEnd).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
        : null;

    return (
        <div className="max-w-8xl mx-auto animate-in fade-in duration-700 pt-2 pb-8 sm:pb-0">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-start">
                <div className="flex-1 order-1 lg:order-1 pt-2 sm:pt-4 w-full">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">Checkout Seguro</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mb-6">Finalize sua assinatura em poucos segundos.</p>

                    {/* Seletor de Método de Pagamento */}
                    <div className="flex gap-2 mb-2">
                        <button
                            onClick={() => setPaymentTab('card')}
                            className={`flex-1 flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all ${paymentTab === 'card'
                                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold'
                                : 'border-slate-100 dark:border-slate-700/30 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                                }`}
                        >
                            <CreditCard className="w-4 sm:w-5 h-4 sm:h-5" />
                            <span className="text-sm sm:text-base">Cartão</span>
                        </button>
                        <button
                            onClick={() => setPaymentTab('pix')}
                            className={`flex-1 flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all ${paymentTab === 'pix'
                                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold'
                                : 'border-slate-100 dark:border-slate-700/30 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                                }`}
                        >
                            <Wallet className={`w-4 sm:w-5 h-4 sm:h-5 ${paymentTab === 'pix' ? 'text-emerald-500' : ''}`} />
                            <span className="text-sm sm:text-base">Pix</span>
                        </button>
                    </div>

                    {paymentTab === 'card' ? (
                        <Elements stripe={stripePromise} options={{ locale: 'pt-BR' } as any}>
                            <StripeCardForm plan={plan} onSuccess={onSuccess} status={status} setStatus={setStatus} priceLabel={priceLabel} invoiceId={selectedInvoice?.id} />
                        </Elements>
                    ) : (
                        <div className="space-y-4">
                            {status && (
                                <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-500/10 dark:border-red-500/20'
                                    }`}>
                                    {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                                    {status.message}
                                </div>
                            )}

                            {pixData ? (
                                <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm animate-in zoom-in duration-300">
                                    <div className="text-center mb-5">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1.5">Pague com Pix</h3>
                                        <p className="text-sm text-slate-500 max-w-xs">
                                            Abra o app do seu banco, escolha a opção Pix e escaneie o código abaixo.
                                        </p>
                                    </div>

                                    <div className={`bg-white p-4 rounded-2xl border-4 shadow-inner mb-5 relative transition-all ${pixExpired ? 'border-slate-200 grayscale opacity-50' : 'border-emerald-50'}`}>
                                        <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code Pix" className="w-48 h-48 object-contain" />
                                        {status?.type === 'success' && (
                                            <div className="absolute inset-0 bg-emerald-500/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-white animate-in zoom-in">
                                                <CheckCircle2 className="w-12 h-12 mb-2" />
                                                <span className="font-bold text-sm">Pago!</span>
                                            </div>
                                        )}
                                        {pixExpired && !status?.type && (
                                            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center text-white">
                                                <AlertTriangle className="w-10 h-10 mb-2 text-amber-400" />
                                                <span className="font-bold text-sm">QR expirado</span>
                                            </div>
                                        )}
                                    </div>

                                    {!pixExpired && !status?.type && pixRemainingMs > 0 && (
                                        <div className="mb-5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                            Expira em <span className="font-mono tabular-nums">{formatPixCountdown(pixRemainingMs)}</span>
                                        </div>
                                    )}

                                    <div className={`w-full max-w-sm space-y-3 transition-opacity ${pixExpired ? 'opacity-40 pointer-events-none' : ''}`}>
                                        <label className="block text-xs font-bold text-slate-500 text-center uppercase tracking-wider">Ou use o Copia e Cola</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={pixData.qr_code}
                                                className="flex-1 px-3 py-2 bg-[#f9fafb] dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700/30 rounded-lg text-xs font-mono text-slate-500 truncate outline-none select-all"
                                                onClick={(e) => (e.target as HTMLInputElement).select()}
                                            />
                                            <button
                                                onClick={handleCopyPix}
                                                disabled={pixExpired}
                                                className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${pixCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800'}`}
                                            >
                                                {pixCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                {pixCopied ? 'Copiado!' : 'Copiar'}
                                            </button>
                                        </div>
                                    </div>

                                    {pixExpired && !status?.type && (
                                        <button
                                            onClick={() => { setPixData(null); setStatus(null); }}
                                            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Gerar novo QR Code
                                        </button>
                                    )}

                                    {!pixExpired && !status?.type && (
                                        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            Aguardando pagamento...
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <form onSubmit={handleGeneratePix} className="space-y-4">
                                    <div className="p-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl">
                                        <h3 className="text-emerald-800 dark:text-emerald-400 font-bold mb-2 flex items-center gap-2">
                                            <Wallet className="w-5 h-5" /> Pagamento com Pix
                                        </h3>
                                        <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed mb-4">
                                            O pagamento via Pix proporciona liberação imediata da sua assinatura. Precisamos apenas de alguns dados para gerar a cobrança.
                                        </p>

                                        <div className="space-y-4 bg-white dark:bg-[#1a1d23] p-4 rounded-xl border border-slate-100 dark:border-slate-700/30">
                                            <div>
                                                <label className={labelClasses}>Nome Completo</label>
                                                <div className="relative">
                                                    <div className={iconClasses}><User className="w-4.5 h-4.5" /></div>
                                                    <input
                                                        type="text"
                                                        name="cardholderName"
                                                        value={formData.cardholderName}
                                                        onChange={handleInputChange}
                                                        className={inputClasses}
                                                        placeholder="Seu nome"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelClasses}>CPF / CNPJ</label>
                                                <div className="relative">
                                                    <div className={iconClasses}><ShieldCheck className="w-4.5 h-4.5" /></div>
                                                    <input
                                                        type="text"
                                                        name="identificationNumber"
                                                        value={formData.identificationNumber}
                                                        onChange={handleInputChange}
                                                        className={inputClasses}
                                                        placeholder="Documento"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelClasses}>E-mail</label>
                                                <div className="relative">
                                                    <div className={iconClasses}><Mail className="w-4.5 h-4.5" /></div>
                                                    <input
                                                        type="email"
                                                        name="email"
                                                        value={formData.email}
                                                        onChange={handleInputChange}
                                                        className={inputClasses}
                                                        placeholder="seu@e-mail.com"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={pixLoading}
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-xl shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-3 text-lg"
                                    >
                                        {pixLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                                        {pixLoading ? 'Gerando Pix...' : 'Gerar QR Code Pix'}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}
                </div>

                {/* Coluna Direita: Resumo do Plano */}
                <div className="w-full lg:w-[340px] order-2 lg:order-2">
                    <div className="lg:sticky lg:top-8 bg-slate-900 dark:bg-[#1a1d23] text-white p-5 sm:p-6 rounded-2xl shadow-xl relative overflow-hidden border border-white/5">

                        <div className="relative z-10">
                            <div className="mb-5">
                                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400/70 block mb-0.5">
                                    {selectedInvoice ? 'Pagando fatura' : 'Assinando o plano'}
                                </span>
                                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                                    {selectedPeriodLabel || plan.name}
                                </h2>
                                {selectedInvoice && (
                                    <p className="text-xs text-slate-400 mt-1">Plano {plan.name}</p>
                                )}
                            </div>

                            {!selectedInvoice && (
                                <div className="border-t border-white/10 pt-4 mb-5">
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 text-slate-400">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        Benefícios inclusos
                                    </h3>

                                    <div className="space-y-2">
                                        {features.map((feature, idx) => (
                                            <div key={idx} className="flex gap-2.5 text-[13px]">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-[3px]" />
                                                <span className="text-slate-300 leading-snug">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2 pt-4 border-t border-white/10">
                                <div className="flex justify-between items-center text-[13px]">
                                    <span className="text-slate-400">{selectedInvoice ? 'Valor da fatura' : 'Mensalidade'}</span>
                                    <span className="font-semibold text-slate-200">R$ {chargeAmount?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-3 mt-1 border-t border-white/10">
                                    <span className="font-bold text-sm">Total hoje</span>
                                    <span className="font-black text-xl text-emerald-400">R$ {chargeAmount?.toFixed(2)}</span>
                                </div>
                            </div>

                            {remainingAfter && remainingAfter.count > 0 && (
                                <div className="mt-4 py-3 px-3.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                    <p className="text-[11px] text-amber-300 leading-relaxed">
                                        Após este pagamento, <span className="font-bold">{remainingAfter.count} {remainingAfter.count === 1 ? 'fatura' : 'faturas'}</span> {remainingAfter.count === 1 ? 'continuará' : 'continuarão'} pendente{remainingAfter.count === 1 ? '' : 's'}
                                        <span className="block font-bold text-amber-200 mt-0.5">R$ {remainingAfter.total.toFixed(2)}</span>
                                    </p>
                                </div>
                            )}

                            <div className="mt-5 py-2.5 px-3 bg-white/5 rounded-lg border border-white/5 flex items-center gap-2 justify-center">
                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                <span className="text-[10px] font-medium tracking-wide text-slate-400">Cancele quando quiser · Sem fidelidade</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
