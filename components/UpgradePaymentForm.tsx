import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { CreditCard, Lock, Calendar, User, ShieldCheck, Mail, AlertTriangle, Loader2 } from 'lucide-react';

declare global {
    interface Window {
        MercadoPago: any;
    }
}

interface UpgradePaymentFormProps {
    plan: {
        id: string;
        name: string;
        priceRaw: number;
    };
    onSuccess: () => void;
    onCancel: () => void;
    email?: string;
}

export const UpgradePaymentForm: React.FC<UpgradePaymentFormProps> = ({ plan, onSuccess, onCancel, email }) => {
    const [mp, setMp] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        cardNumber: '',
        cardholderName: '',
        cardExpirationMonth: '',
        cardExpirationYear: '',
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
            const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;
            if (publicKey) {
                try {
                    const mpInstance = new window.MercadoPago(publicKey);
                    setMp(mpInstance);
                } catch (e) {
                    console.error("Failed to initialize Mercado Pago", e);
                }
            }
        };
        document.body.appendChild(script);

        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
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
                throw new Error('Could not identify payment method (Brand)');
            }

            const tokenResponse = await mp.createCardToken({
                cardNumber: formData.cardNumber.replace(/\s/g, ''),
                cardholderName: formData.cardholderName,
                cardExpirationMonth: formData.cardExpirationMonth,
                cardExpirationYear: formData.cardExpirationYear,
                securityCode: formData.securityCode,
                identification: {
                    type: formData.identificationType,
                    number: formData.identificationNumber
                }
            });

            if (!tokenResponse.id) {
                throw new Error('Failed to generate card token');
            }

            // Call Backend Subscribe
            await api.post('/payments/subscribe', {
                planId: plan.id,
                token: tokenResponse.id,
                payment_method_id: paymentMethodId,
                transaction_amount: plan.priceRaw,
                installments: 1,
                payer: {
                    email: formData.email,
                    identification: {
                        type: formData.identificationType,
                        number: formData.identificationNumber
                    }
                }
            });

            setStatus({ type: 'success', message: 'Assinatura realizada com sucesso!' });
            setTimeout(() => {
                onSuccess();
            }, 1000);

        } catch (err: any) {
            console.error('Subscription Error:', err);
            let msg = err.message || 'Erro ao processar pagamento.';
            if (err.response?.data?.error) {
                msg = err.response.data.error;
            }
            setStatus({ type: 'error', message: msg });
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition-all";
    const labelClasses = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5";
    const iconClasses = "absolute left-2.5 top-2.5 w-4 h-4 text-slate-400";

    return (
        <div className="animate-in fade-in slide-in-from-right duration-300">
            <div className="mb-4 bg-sky-50 dark:bg-sky-900/20 p-3 rounded-lg border border-sky-100 dark:border-sky-900/50 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-sky-600 mt-0.5" />
                <div>
                    <p className="text-xs text-sky-800 dark:text-sky-300 font-medium">
                        Plano <span className="font-bold">{plan.name}</span> - <span className="font-bold">R$ {plan.priceRaw?.toFixed(2)}</span>
                    </p>
                </div>
            </div>

            {status && (
                <div className={`p-3 mb-4 rounded-lg text-xs font-bold flex items-center gap-2 ${status.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {status.type === 'error' && <AlertTriangle className="w-4 h-4" />}
                    {status.message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelClasses}>Email</label>
                        <div className="relative">
                            <Mail className={iconClasses} />
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className={inputClasses}
                                placeholder="seu@email.com"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClasses}>CPF</label>
                        <div className="relative">
                            <User className={iconClasses} />
                            <input
                                type="text"
                                name="identificationNumber"
                                value={formData.identificationNumber}
                                onChange={handleInputChange}
                                className={inputClasses}
                                placeholder="000.000.000-00"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                        <label className={labelClasses}>Número do Cartão</label>
                        <div className="relative">
                            <CreditCard className={iconClasses} />
                            <input
                                type="text"
                                name="cardNumber"
                                value={formData.cardNumber}
                                onChange={handleInputChange}
                                className={inputClasses}
                                placeholder="0000 0000 0000 0000"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelClasses}>Nome Impresso</label>
                        <div className="relative">
                            <User className={iconClasses} />
                            <input
                                type="text"
                                name="cardholderName"
                                value={formData.cardholderName}
                                onChange={handleInputChange}
                                className={inputClasses}
                                placeholder="COMO NO CARTÃO"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className={labelClasses}>Validade</label>
                            <div className="flex gap-1">
                                <input
                                    type="text"
                                    name="cardExpirationMonth"
                                    value={formData.cardExpirationMonth}
                                    onChange={handleInputChange}
                                    className={`${inputClasses} px-1 text-center`}
                                    placeholder="MM"
                                    maxLength={2}
                                    required
                                    style={{ paddingLeft: '0.5rem', paddingRight: '0.5rem' }}
                                />
                                <input
                                    type="text"
                                    name="cardExpirationYear"
                                    value={formData.cardExpirationYear}
                                    onChange={handleInputChange}
                                    className={`${inputClasses} px-1 text-center`}
                                    placeholder="YY"
                                    maxLength={2}
                                    required
                                    style={{ paddingLeft: '0.5rem', paddingRight: '0.5rem' }}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={labelClasses}>CVV</label>
                            <div className="relative">
                                <Lock className={iconClasses} />
                                <input
                                    type="text"
                                    name="securityCode"
                                    value={formData.securityCode}
                                    onChange={handleInputChange}
                                    className={inputClasses}
                                    placeholder="123"
                                    maxLength={4}
                                    required
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !mp}
                        className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg shadow-lg shadow-sky-600/20 transition flex items-center justify-center gap-2 text-sm"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {loading ? 'Processando...' : `Confirmar Pagamento`}
                    </button>
                </div>

                <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest">
                    <Lock className="w-3 h-3" />
                    Pagamento seguro via Mercado Pago
                </div>
            </form>
        </div>
    );
};
