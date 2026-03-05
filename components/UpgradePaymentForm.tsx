import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { CreditCard, Lock, Calendar, User, ShieldCheck, Mail, AlertTriangle, Loader2, CheckCircle2, ChevronLeft, Wallet, Minus, Plus } from 'lucide-react';

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
        features?: string[];
    };
    onSuccess: () => void;
    onCancel: () => void;
    email?: string;
}

export const UpgradePaymentForm: React.FC<UpgradePaymentFormProps> = ({ plan, onSuccess, onCancel, email }) => {
    const [mp, setMp] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [paymentTab, setPaymentTab] = useState<'card' | 'pix'>('card');

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

        // Card number formatting
        if (name === 'cardNumber') {
            const formattedValue = value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
            setFormData(prev => ({ ...prev, [name]: formattedValue.substring(0, 19) }));
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

            setStatus({ type: 'success', message: 'Pagamento processado com sucesso! Bem-vindo.' });
            setTimeout(() => {
                onSuccess();
            }, 1500);

        } catch (err: any) {
            console.error('Subscription Error:', err);
            let msg = err.message || 'Erro ao processar pagamento.';
            if (err.response?.data?.error) {
                msg = err.response.data.message || err.response.data.error;
            }
            setStatus({ type: 'error', message: msg });
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400";
    const labelClasses = "block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1";
    const iconClasses = "absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400";

    const features = Array.from(new Set(plan.features || [
        "Acesso total ao sistema de mapas",
        "Suporte técnico prioritário",
        "Exportação de arquivos KMZ/KML",
        "Infraestrutura de alta performance"
    ]));

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
                                : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                                }`}
                        >
                            <CreditCard className="w-4 sm:w-5 h-4 sm:h-5" />
                            <span className="text-sm sm:text-base">Cartão</span>
                        </button>
                        <button
                            onClick={() => setPaymentTab('pix')}
                            className={`flex-1 flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all ${paymentTab === 'pix'
                                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold'
                                : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                                }`}
                        >
                            <Wallet className={`w-4 sm:w-5 h-4 sm:h-5 ${paymentTab === 'pix' ? 'text-emerald-500' : ''}`} />
                            <span className="text-sm sm:text-base">Pix</span>
                        </button>
                    </div>

                    {paymentTab === 'card' ? (
                        <form onSubmit={handleSubmit} className="space-y-2">
                            {status && (
                                <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-500/10 dark:border-red-500/20'
                                    }`}>
                                    {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                                    {status.message}
                                </div>
                            )}

                            <div className="space-y-5">
                                <div>
                                    <div className="flex justify-between items-end mb-1.5 ml-1">
                                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Número do Cartão</label>
                                        <div className="flex gap-1 items-center opacity-60 grayscale scale-90 origin-right">
                                            <img src="https://static.vecteezy.com/system/resources/previews/020/975/572/original/visa-logo-visa-icon-transparent-free-png.png" alt="Visa" className="h-3" />
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1280px-Mastercard-logo.svg.png" alt="Mastercard" className="h-3" />
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <div className={iconClasses}><CreditCard className="w-4.5 h-4.5" /></div>
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

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelClasses}>Data de Validade</label>
                                        <div className="relative">
                                            <div className={iconClasses}><Calendar className="w-4.5 h-4.5" /></div>
                                            <input
                                                type="text"
                                                name="expiry"
                                                value={formData.expiry}
                                                onChange={handleInputChange}
                                                className={inputClasses}
                                                placeholder="MM / AA"
                                                maxLength={5}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClasses}>CVV</label>
                                        <div className="relative">
                                            <div className={iconClasses}><Lock className="w-4.5 h-4.5" /></div>
                                            <input
                                                type="text"
                                                name="securityCode"
                                                value={formData.securityCode}
                                                onChange={handleInputChange}
                                                className={inputClasses}
                                                placeholder="Cód. de segurança"
                                                maxLength={4}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-5 pb-2 border-b border-slate-100 dark:border-slate-800">Dados do Titular</h3>

                                <div className="space-y-5">
                                    <div>
                                        <label className={labelClasses}>Nome no Cartão</label>
                                        <div className="relative">
                                            <div className={iconClasses}><User className="w-4.5 h-4.5" /></div>
                                            <input
                                                type="text"
                                                name="cardholderName"
                                                value={formData.cardholderName}
                                                onChange={handleInputChange}
                                                className={inputClasses}
                                                placeholder="NOME COMPLETO"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClasses}>E-mail para Recebo</label>
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

                                    <div>
                                        <label className={labelClasses}>CPF do Titular</label>
                                        <div className="relative">
                                            <div className={iconClasses}><ShieldCheck className="w-4.5 h-4.5" /></div>
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
                            </div>

                            <div className="pt-6">
                                <button
                                    type="submit"
                                    disabled={loading || !mp}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-3 text-lg active:scale-[0.98]"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Lock className="w-5 h-5" />
                                    )}
                                    {loading ? 'Processando...' : `Assinar`}
                                </button>
                                <p className="mt-4 text-[11px] text-slate-400 text-center leading-relaxed px-4">
                                    Pagamento seguro via Mercado Pago. Ao assinar, você concorda com nossos termos.
                                </p>
                            </div>
                        </form>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 px-8 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                                <Wallet className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Pix disponível em breve</h4>
                            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
                                Estamos finalizando a integração com o Pix. Por enquanto, utilize o pagamento via cartão de crédito para ativação imediata.
                            </p>
                            <button
                                onClick={() => setPaymentTab('card')}
                                className="mt-6 text-emerald-600 font-bold hover:underline"
                            >
                                Usar Cartão de Crédito
                            </button>
                        </div>
                    )}
                </div>

                {/* Coluna Direita: Resumo do Plano */}
                <div className="w-full lg:w-[350px] order-2 lg:order-2">
                    <div className="lg:sticky lg:top-8 bg-slate-900 dark:bg-slate-950 text-white p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-white/5">

                        <div className="relative z-10">
                            <div className="mb-6">
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500/60 block mb-1">Assinando o plano</span>
                                <h2 className="text-3xl font-black text-white tracking-tight">{plan.name}</h2>
                            </div>

                            <h3 className="text-sm font-bold mb-6 flex items-center gap-3 text-slate-400 border-t border-white/5 pt-6">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                Resumo dos Benefícios
                            </h3>

                            <div className="space-y-4 mb-10 pt-6 border-t border-white/10">
                                {features.map((feature, idx) => (
                                    <div key={idx} className="flex gap-3 text-sm">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                        <span className="text-slate-300">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3 pt-6 border-t border-white/10">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">Total Mensal</span>
                                    <span className="font-bold">R$ {plan.priceRaw?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-4 mt-2 border-t border-white/20">
                                    <span className="font-bold text-lg">Total hoje</span>
                                    <span className="font-black text-2xl text-emerald-400">R$ {plan.priceRaw?.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="mt-10 py-4 px-6 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3 justify-center">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pagamento Seguro</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
