import React, { useState, useEffect, useMemo } from 'react';
import { Customer, CTOData, Splitter } from '../../types';
import { useLanguage } from '../../LanguageContext';
import { X, Save, MapPin, User, Phone, FileText, Search, Network } from 'lucide-react';

interface CustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (customer: Partial<Customer>) => Promise<void>;
    initialData?: Partial<Customer>;
    ctos: CTOData[]; // All CTOs to search for nearest
    allCustomers: Customer[]; // To check port occupancy
    onStartDrawingDrop?: (customerId: string, coords?: { lat: number, lng: number }) => void;
    onReposition?: (customer: Partial<Customer>) => void;
}

const TABS = {
    DATA: 'DATA',
    CONNECTION: 'CONNECTION'
};

import { CustomerSearchInput } from '../interactions/CustomerSearchInput';

export const CustomerModal: React.FC<CustomerModalProps> = ({
    isOpen, onClose, onSave, initialData, ctos, allCustomers, onStartDrawingDrop, onReposition
}) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState(TABS.DATA);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Customer>>({
        name: '',
        document: '',
        phone: '',
        email: '',
        address: '',
        status: 'ACTIVE',
        lat: 0,
        lng: 0,
        onuSerial: '',
        onuMac: '',
        pppoeService: '',
        onuPower: '',
        ...initialData
    });

    // Connection State
    const [selectedCtoId, setSelectedCtoId] = useState<string | null>(initialData?.ctoId || null);
    const [selectedSplitterId, setSelectedSplitterId] = useState<string | null>(initialData?.splitterId || null);
    const [selectedPortIndex, setSelectedPortIndex] = useState<number | null>(initialData?.splitterPortIndex !== undefined ? initialData.splitterPortIndex : null);

    // Update form when initialData changes
    useEffect(() => {
        if (initialData) {
            // Reset to defaults first, then apply initialData
            setFormData({
                name: '',
                document: '',
                phone: '',
                email: '',
                address: '',
                status: 'ACTIVE',
                lat: 0,
                lng: 0,
                onuSerial: '',
                onuMac: '',
                pppoeService: '',
                onuPower: '',
                ...initialData
            });
            setSelectedCtoId(initialData.ctoId || null);
            setSelectedSplitterId(initialData.splitterId || null);
            setSelectedPortIndex(initialData.splitterPortIndex !== undefined ? initialData.splitterPortIndex : null);
            setActiveTab(TABS.DATA); // Also reset to first tab
        }
    }, [initialData]);

    // Nearest CTOs
    const nearbyCtos = useMemo(() => {
        if (!formData.lat || !formData.lng) return [];
        return [...ctos].map(cto => {
            const dist = Math.sqrt(
                Math.pow(cto.coordinates.lat - formData.lat!, 2) +
                Math.pow(cto.coordinates.lng - formData.lng!, 2)
            );
            return { ...cto, distance: dist };
        }).sort((a, b) => a.distance - b.distance).slice(0, 10); // Top 10 nearest
    }, [ctos, formData.lat, formData.lng]);

    // Selected CTO Data
    const selectedCto = useMemo(() =>
        ctos.find(c => c.id === selectedCtoId),
        [ctos, selectedCtoId]);

    // Available Splitters in Selected CTO
    const splitters = useMemo(() => {
        if (!selectedCto?.splitters) return [];
        return selectedCto.splitters; // Return all splitters, we disabled the blocked ones in UI
    }, [selectedCto]);

    // Selected Splitter
    const selectedSplitter = useMemo(() =>
        splitters.find(s => s.id === selectedSplitterId),
        [splitters, selectedSplitterId]);

    // Port Occupancy Logic
    const ports = useMemo(() => {
        if (!selectedSplitter) return [];

        let portCount = 8;
        if (selectedSplitter.type) {
            const match = selectedSplitter.type.match(/1x(\d+)/);
            if (match) portCount = parseInt(match[1]);
        }
        if (selectedSplitter.outputPortIds && selectedSplitter.outputPortIds.length > 0) {
            portCount = Math.max(portCount, selectedSplitter.outputPortIds.length);
        }

        const portStatus = Array(portCount).fill(null).map((_, index) => {
            const occupant = allCustomers.find(c =>
                c.ctoId === selectedCtoId &&
                c.splitterId === selectedSplitterId &&
                c.splitterPortIndex === index &&
                c.id !== formData.id
            );
            return {
                index,
                occupied: !!occupant,
                occupantName: occupant?.name
            };
        });

        return portStatus;
    }, [selectedSplitter, allCustomers, selectedCtoId, selectedSplitterId, formData.id]);


    const handleSave = async () => {
        setLoading(true);
        try {
            await onSave({
                ...formData,
                ctoId: selectedCtoId,
                splitterId: selectedSplitterId,
                splitterPortIndex: selectedPortIndex,
                updatedAt: new Date().toISOString()
            });
            onClose();
        } catch (error) {
            console.error("Error saving customer:", error);
            alert(t('error_save_customer') || "Erro ao salvar cliente.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-[600px] max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">

                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <User className="w-5 h-5 text-indigo-500" />
                        {t('customer_modal_title')}
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex border-b border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab(TABS.DATA)}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === TABS.DATA
                            ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <FileText size={16} />
                        {t('customer_data')}
                    </button>
                    <button
                        onClick={() => setActiveTab(TABS.CONNECTION)}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === TABS.CONNECTION
                            ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <Network size={16} />
                        {t('customer_connection')} ({selectedPortIndex !== null ? '1' : '0'})
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">

                    {activeTab === TABS.DATA && (
                        <div className="space-y-4">
                            {!initialData?.id && (
                                <CustomerSearchInput
                                    allCustomers={allCustomers}
                                    onSelect={(c) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            id: c.id,
                                            name: c.name,
                                            document: c.document,
                                            phone: c.phone,
                                            email: c.email,
                                            address: c.address,
                                            status: c.status,
                                            onuSerial: c.onuSerial,
                                            onuMac: c.onuMac,
                                            pppoeService: c.pppoeService,
                                            onuPower: c.onuPower
                                        }));
                                    }}
                                />
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('customer_name')} *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                        placeholder={t('customer_name')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('customer_doc')}</label>
                                    <input
                                        type="text"
                                        value={formData.document || ''}
                                        onChange={e => setFormData({ ...formData, document: e.target.value })}
                                        className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                        placeholder={t('customer_doc_placeholder') || "CPF / CNPJ"}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('customer_phone')}</label>
                                    <input
                                        type="text"
                                        value={formData.phone || ''}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                        placeholder={t('customer_phone_placeholder') || "(00) 00000-0000"}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('email')}</label>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                        placeholder={t('customer_email_placeholder') || "cliente@email.com"}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('customer_address')}</label>
                                <div className="flex gap-2">
                                    <MapPin className="text-slate-400 mt-2" size={16} />
                                    <textarea
                                        value={formData.address || ''}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        className="flex-1 p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                        rows={2}
                                        placeholder={t('customer_address')}
                                    />
                                    {onReposition && formData.id && (
                                        <button
                                            type="button"
                                            onClick={() => onReposition(formData)}
                                            className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded border border-amber-200 text-xs font-bold transition flex flex-col items-center justify-center gap-1"
                                            title={t('reposition_customer')}
                                        >
                                            <MapPin size={16} />
                                            <span>{t('change')}</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('customer_status_title')}</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                >
                                    <option value="ACTIVE">{t('customer_status_active')}</option>
                                    <option value="INACTIVE">{t('customer_status_inactive')}</option>
                                    <option value="PLANNED">{t('customer_status_planned')}</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {activeTab === TABS.CONNECTION && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">
                                    {formData.ctoId ? t('connected_cto') : t('select_cto')}
                                </label>

                                {selectedCtoId ? (
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-slate-800 dark:text-slate-200">{selectedCto?.name}</div>
                                            <div className="text-xs text-slate-500">{selectedCto?.address}</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedCtoId(null);
                                                setSelectedSplitterId(null);
                                                setSelectedPortIndex(null);
                                            }}
                                            className="text-xs text-indigo-500 hover:underline"
                                        >
                                            {t('change')}
                                        </button>

                                        {/* Disconnect Option */}
                                        {!!formData.ctoId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (confirm(t('confirm_disconnect') || 'Tem certeza que deseja desconectar este cliente? Isso removerá o cabo e a conexão.')) {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            ctoId: null,
                                                            splitterId: null,
                                                            splitterPortIndex: null
                                                        }));
                                                        setSelectedCtoId(null);
                                                        setSelectedSplitterId(null);
                                                        setSelectedPortIndex(null);
                                                    }
                                                }}
                                                className="ml-2 text-xs text-red-500 hover:text-red-700 font-bold border border-red-200 bg-red-50 px-2 py-0.5 rounded"
                                            >
                                                {t('disconnect') || 'Desconectar'}
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    nearbyCtos.length === 0 ? (
                                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 text-sm rounded border border-amber-200">
                                            {t('no_ctos_near')}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded p-2">
                                            {nearbyCtos.map(cto => (
                                                <button
                                                    key={cto.id}
                                                    onClick={() => {
                                                        setSelectedCtoId(cto.id);
                                                        setSelectedSplitterId(null);
                                                        setSelectedPortIndex(null);
                                                    }}
                                                    className={`p-2 text-left rounded text-sm flex justify-between items-center ${selectedCtoId === cto.id
                                                        ? 'bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-600'
                                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                                        }`}
                                                >
                                                    <span className="font-medium">{cto.name}</span>
                                                    <span className="text-xs text-slate-500">{(cto.distance! * 100000).toFixed(0)}m</span>
                                                </button>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>

                            {selectedCtoId && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">{t('select_splitter')}</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {splitters.length === 0 && <span className="text-sm text-slate-500 italic">{t('no_splitters_in_cto')}</span>}
                                            {splitters.map(splitter => (
                                                <button
                                                    key={splitter.id}
                                                    disabled={(!!formData.splitterId && formData.splitterId !== splitter.id) || splitter.allowCustomConnections === false}
                                                    onClick={() => {
                                                        setSelectedSplitterId(splitter.id);
                                                        setSelectedPortIndex(null);
                                                    }}
                                                    title={splitter.allowCustomConnections === false ? (t('splitter_blocked_desc') || "Este splitter não permite conexão de clientes") : ""}
                                                    className={`px-3 py-1.5 rounded text-sm border transition-all ${selectedSplitterId === splitter.id
                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                        : splitter.allowCustomConnections === false
                                                            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed opacity-70'
                                                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:bg-slate-50'
                                                        } ${(!!formData.splitterId && formData.splitterId !== splitter.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    {splitter.name} ({splitter.type})
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {selectedSplitterId && (
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t('select_port')}</label>
                                            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                                                {ports.map(port => (
                                                    <button
                                                        key={port.index}
                                                        disabled={port.occupied || (formData.splitterPortIndex !== null && formData.splitterPortIndex !== port.index)}
                                                        onClick={() => setSelectedPortIndex(port.index)}
                                                        className={`
                                                            relative h-10 rounded border flex items-center justify-center text-sm font-bold transition-all
                                                            ${port.occupied
                                                                ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-400 cursor-not-allowed'
                                                                : selectedPortIndex === port.index
                                                                    ? 'bg-green-500 text-white border-green-600 shadow-md ring-2 ring-green-200 dark:ring-green-900'
                                                                    : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-green-400 hover:text-green-600'
                                                            }
                                                            ${(formData.splitterPortIndex !== null && formData.splitterPortIndex !== port.index) ? 'opacity-50 cursor-not-allowed' : ''}
                                                        `}
                                                        title={port.occupied ? t('port_occupied_by', { name: port.occupantName || '' }) : t('port_free')}
                                                    >
                                                        {port.index + 1}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}


                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                    <User className="w-4 h-4 text-indigo-500" />
                                    {t('onu_data_section')}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">{t('onu_serial')}</label>
                                        <input
                                            type="text"
                                            value={formData.onuSerial || ''}
                                            onChange={e => setFormData({ ...formData, onuSerial: e.target.value })}
                                            className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                            placeholder={t('onu_serial_placeholder') || "Ex: ZTEG12345678"}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t('pppoe_user')}</label>
                                            <input
                                                type="text"
                                                value={formData.pppoeService || ''}
                                                onChange={e => setFormData({ ...formData, pppoeService: e.target.value })}
                                                className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                                placeholder={t('pppoe_user_placeholder') || "usuario@pppoe"}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t('onu_mac')}</label>
                                            <input
                                                type="text"
                                                value={formData.onuMac || ''}
                                                onChange={e => {
                                                    let value = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '');
                                                    if (value.length > 12) value = value.substring(0, 12);
                                                    const parts = value.match(/.{1,2}/g) || [];
                                                    const masked = parts.join(':');
                                                    setFormData({ ...formData, onuMac: masked });
                                                }}
                                                className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-mono"
                                                placeholder="00:00:00:00:00:00"
                                                maxLength={17}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t('onu_power')}</label>
                                            <input
                                                type="text"
                                                value={formData.onuPower || ''}
                                                onChange={e => setFormData({ ...formData, onuPower: e.target.value })}
                                                className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                                placeholder="-20.50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t('drop_length')}</label>
                                            <div className="flex gap-2">
                                                <div className="flex-1 p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-sm text-slate-600 dark:text-slate-400">
                                                    {(() => {
                                                        // Use pre-calculated length if available
                                                        if (initialData?.drop?.length) return `${initialData.drop.length.toFixed(1)} ${t('meters_abbrev')}`;

                                                        // Calculate on the fly if coordinates exist
                                                        if (initialData?.drop?.coordinates && initialData.drop.coordinates.length > 1) {
                                                            const coords = initialData.drop.coordinates;
                                                            let totalDist = 0;
                                                            for (let i = 0; i < coords.length - 1; i++) {
                                                                const R = 6371e3; // metres
                                                                const φ1 = coords[i].lat * Math.PI / 180;
                                                                const φ2 = coords[i + 1].lat * Math.PI / 180;
                                                                const Δφ = (coords[i + 1].lat - coords[i].lat) * Math.PI / 180;
                                                                const Δλ = (coords[i + 1].lng - coords[i].lng) * Math.PI / 180;

                                                                const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                                                                    Math.cos(φ1) * Math.cos(φ2) *
                                                                    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                                                                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

                                                                totalDist += R * c;
                                                            }
                                                            return `${totalDist.toFixed(1)} ${t('meters_abbrev')}`;
                                                        }

                                                        return '---';
                                                    })()}
                                                </div>
                                                {formData.id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (onStartDrawingDrop && formData.id) {
                                                                onStartDrawingDrop(formData.id, { lat: formData.lat || 0, lng: formData.lng || 0 });
                                                                onClose();
                                                            }
                                                        }}
                                                        className="px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded border border-emerald-700 shadow-sm transition-colors flex items-center justify-center gap-2"
                                                        title={t('draw_customer_drop_desc') || "Desenhar cabo do cliente"}
                                                    >
                                                        <Network className="w-4 h-4" />
                                                        <span className="text-xs font-bold hidden sm:inline">{t('draw_drop') || "Desenhar"}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || !formData.name}
                        className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? t('saving') : (
                            <>
                                <Save size={16} />
                                {t('save_customer')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
