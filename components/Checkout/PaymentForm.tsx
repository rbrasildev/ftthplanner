import React, { useState, useEffect } from 'react';
import api from '../../services/api';

declare global {
    interface Window {
        MercadoPago: any;
    }
}

export const PaymentForm: React.FC = () => {
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
        email: '',
        identificationType: 'CPF',
        identificationNumber: ''
    });

    useEffect(() => {
        // Dynamically load Mercado Pago SDK
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
            } else {
                console.error("VITE_MERCADOPAGO_PUBLIC_KEY not defined in .env");
            }
        };
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            // 1. Identify Payment Method ID based on BIN (first 6 digits)
            const bin = formData.cardNumber.replace(/\s/g, '').substring(0, 6);
            const paymentMethodId = await getPaymentMethodId(bin);

            if (!paymentMethodId) {
                throw new Error('Could not identify payment method (Brand)');
            }

            // 2. Create Card Token
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

            // 3. Process Payment on Backend
            const payload = {
                token: tokenResponse.id,
                payment_method_id: paymentMethodId,
                transaction_amount: 100, // Hardcoded for demo/test purposes as requested
                description: "Test Payment",
                installments: 1,
                payer: {
                    email: formData.email,
                    identification: {
                        type: formData.identificationType,
                        number: formData.identificationNumber
                    }
                }
            };

            const response = await api.post('/payments/process_payment', payload);

            setStatus({
                type: 'success',
                message: `Payment Approved! ID: ${response.data.id} - Status: ${response.data.status}`
            });

        } catch (err: any) {
            console.error('Payment Error:', err);
            let msg = err.message || 'An unexpected error occurred.';
            if (err.response && err.response.data && err.response.data.error) {
                msg = err.response.data.error;
            }
            setStatus({ type: 'error', message: msg });
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = "w-full p-2 mb-3 border border-gray-300 rounded focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white";
    const labelStyle = "block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md mt-10">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Checkout Transparente</h2>

            {status && (
                <div className={`p-4 mb-4 rounded ${status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {status.message}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div>
                    <label className={labelStyle}>Email</label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={inputStyle}
                        placeholder="example@gmail.com"
                        required
                    />
                </div>

                <div>
                    <label className={labelStyle}>Card Number</label>
                    <input
                        type="text"
                        name="cardNumber"
                        value={formData.cardNumber}
                        onChange={handleInputChange}
                        className={inputStyle}
                        placeholder="0000 0000 0000 0000"
                        required
                    />
                </div>

                <div>
                    <label className={labelStyle}>Cardholder Name</label>
                    <input
                        type="text"
                        name="cardholderName"
                        value={formData.cardholderName}
                        onChange={handleInputChange}
                        className={inputStyle}
                        placeholder="YOUR NAME"
                        required
                    />
                </div>

                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className={labelStyle}>Exp. Month</label>
                        <input
                            type="text"
                            name="cardExpirationMonth"
                            value={formData.cardExpirationMonth}
                            onChange={handleInputChange}
                            className={inputStyle}
                            placeholder="MM"
                            maxLength={2}
                            required
                        />
                    </div>
                    <div className="flex-1">
                        <label className={labelStyle}>Exp. Year</label>
                        <input
                            type="text"
                            name="cardExpirationYear"
                            value={formData.cardExpirationYear}
                            onChange={handleInputChange}
                            className={inputStyle}
                            placeholder="YY"
                            maxLength={2}
                            required
                        />
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className={labelStyle}>CVV</label>
                        <input
                            type="text"
                            name="securityCode"
                            value={formData.securityCode}
                            onChange={handleInputChange}
                            className={inputStyle}
                            placeholder="123"
                            maxLength={4}
                            required
                        />
                    </div>
                    <div className="flex-1">
                        <label className={labelStyle}>CPF</label>
                        <input
                            type="text"
                            name="identificationNumber"
                            value={formData.identificationNumber}
                            onChange={handleInputChange}
                            className={inputStyle}
                            placeholder="000.000.000-00"
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || !mp}
                    className={`w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition duration-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {loading ? 'Processing...' : 'Pay Now'}
                </button>
            </form>
            <div className="mt-4 text-xs text-center text-gray-500">
                Protected by Mercado Pago
            </div>
        </div>
    );
};
