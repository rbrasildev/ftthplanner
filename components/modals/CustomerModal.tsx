import React, { useState, useEffect, useMemo } from 'react';
import { Customer, CTOData, Splitter } from '../../types';
import { useLanguage } from '../../LanguageContext';
import { X, Save, MapPin, User, Phone, FileText, Search, Network, AlertTriangle, Zap } from 'lucide-react';
import { CustomInput } from '../common/CustomInput';
import { CustomSelect } from '../common/CustomSelect';
import { getSplitterPortCount } from '../../utils/splitterUtils';

interface CustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (customer: Partial<Customer>) => Promise<void>;
    initialData?: Partial<Customer>;
    ctos: CTOData[]; // All CTOs to search for nearest
    allCustomers: Customer[]; // To check port occupancy
    onStartDrawingDrop?: (customerId: string, coords?: { lat: number, lng: number }) => void;
    onReposition?: (customer: Partial<Customer>) => void;
    showToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const TABS = {
    DATA: 'DATA',
    CONNECTION: 'CONNECTION'
};

import { CustomerSearchInput } from '../interactions/CustomerSearchInput';
import { searchSgpCustomer } from '../../services/customerService';

export const CustomerModal: React.FC<CustomerModalProps> = ({
    isOpen, onClose, onSave, initialData, ctos, allCustomers, onStartDrawingDrop, onReposition, showToast
}) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState(TABS.DATA);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Customer>>({
        ...initialData,
        name: initialData?.name || '',
        document: initialData?.document || '',
        phone: initialData?.phone || '',
        email: initialData?.email || '',
        address: initialData?.address || '',
        lat: initialData?.lat || 0,
        lng: initialData?.lng || 0,
        ctoId: initialData?.ctoId || null,
        splitterId: initialData?.splitterId || null,
        splitterPortIndex: initialData?.splitterPortIndex ?? null,
        fiberId: initialData?.fiberId || null,
        status: initialData?.status || 'ACTIVE',
        onuSerial: initialData?.onuSerial || '',
        onuMac: initialData?.onuMac || '',
        pppoeService: initialData?.pppoeService || '',
        onuPower: initialData?.onuPower ? String(initialData?.onuPower) : '',
        connectionStatus: initialData?.connectionStatus || null
    });

    // Connection State
    const [selectedCtoId, setSelectedCtoId] = useState<string | null>(initialData?.ctoId || null);
    const [selectedSplitterId, setSelectedSplitterId] = useState<string | null>(initialData?.splitterId || null);
    const [selectedPortIndex, setSelectedPortIndex] = useState<number | null>(initialData?.splitterPortIndex !== undefined ? initialData.splitterPortIndex : null);
    const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(initialData?.connectorId || null);
    // Which attachment tab is active — auto-initialized based on what the customer already has.
    const [attachmentMode, setAttachmentMode] = useState<'splitter' | 'connector'>(initialData?.connectorId ? 'connector' : 'splitter');

    // Update form when initialData changes
    useEffect(() => {
        if (initialData) {
            // Reset to defaults first, then apply initialData
            setFormData({
                ...initialData,
                name: initialData.name || '',
                document: initialData.document || '',
                phone: initialData.phone || '',
                email: initialData.email || '',
                address: initialData.address || '',
                lat: initialData.lat || 0,
                lng: initialData.lng || 0,
                ctoId: initialData.ctoId || null,
                splitterId: initialData.splitterId || null,
                splitterPortIndex: initialData.splitterPortIndex ?? null,
                fiberId: initialData.fiberId || null,
                status: initialData.status || 'ACTIVE',
                onuSerial: initialData.onuSerial || '',
                onuMac: initialData.onuMac || '',
                pppoeService: initialData.pppoeService || '',
                onuPower: initialData.onuPower ? String(initialData.onuPower) : '',
                connectionStatus: initialData.connectionStatus || null
            });
            setSelectedCtoId(initialData.ctoId || null);
            setSelectedSplitterId(initialData.splitterId || null);
            setSelectedPortIndex(initialData.splitterPortIndex !== undefined ? initialData.splitterPortIndex : null);
            setSelectedConnectorId(initialData.connectorId || null);
            setAttachmentMode(initialData.connectorId ? 'connector' : 'splitter');
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
        }).sort((a, b) => a.distance - b.distance);
    }, [formData.lat, formData.lng, ctos]);

    // SGP Search State
    const [isSearchingSgp, setIsSearchingSgp] = useState(false);
    const [sgpSearchError, setSgpSearchError] = useState<string | null>(null);
    const [sgpSuggestedPort, setSgpSuggestedPort] = useState<number | null>(null);
    const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
    const [sgpServicesList, setSgpServicesList] = useState<any[]>([]);
    const [sgpCustomerRaw, setSgpCustomerRaw] = useState<any>(null);

    const applySgpService = (sgpCustomer: any, contract: any, service: any, silent = false) => {
        const onuData = service.onu || {};
        const contactData = sgpCustomer.contatos || {};

        // Get formatted address from the service or main customer
        const addrData = service.endereco || sgpCustomer.endereco || {};

        // Get coordinates: try service-level (IXC radusuarios), then customer-level, then address object
        const latStr = service.latitude || sgpCustomer.lat || addrData.latitude || "";
        const lngStr = service.longitude || sgpCustomer.lng || addrData.longitude || "";
        const newLat = latStr !== "" && latStr !== null ? parseFloat(String(latStr)) : formData.lat;
        const newLng = lngStr !== "" && lngStr !== null ? parseFloat(String(lngStr)) : formData.lng;

        const servicoStatus = service.status || sgpCustomer.status;

        const updatedData = {
            ...formData,
            name: sgpCustomer.nome || formData.name,
            email: contactData.emails?.[0] || sgpCustomer.email || formData.email,
            phone: contactData.celulares?.[0] || sgpCustomer.telefone || sgpCustomer.celular || formData.phone,
            address: addrData,
            onuSerial: onuData.serial || formData.onuSerial,
            onuMac: service.mac || onuData.mac || formData.onuMac || "",
            pppoeService: service.login || formData.pppoeService,
            onuPower: onuData.rx ? String(onuData.rx) : formData.onuPower,
            status: servicoStatus?.toLowerCase() === 'ativo' ? 'ACTIVE' :
                    (servicoStatus?.toLowerCase() === 'suspenso' ? 'SUSPENDED' :
                    (servicoStatus?.toLowerCase() === 'cancelado' ? 'INACTIVE' : formData.status)),
            connectionStatus: onuData.conexao?.status
                ? String(onuData.conexao.status).toLowerCase().trim()
                : (onuData.serial || service.mac ? 'offline' : formData.connectionStatus),
            lat: !isNaN(newLat) && latStr !== "" && latStr !== null ? newLat : formData.lat,
            lng: !isNaN(newLng) && lngStr !== "" && lngStr !== null ? newLng : formData.lng
        };

        // Auto-assign port: try IXC ftth_porta, then generic SGP splitter.porta
        const sgpPortStr = service.ftth_porta || onuData.splitter?.porta || service.onu?.splitter?.porta;
        const sgpPort = sgpPortStr !== null && sgpPortStr !== undefined ? parseInt(String(sgpPortStr), 10) : null;

        if (sgpPort !== null && !isNaN(sgpPort)) {
            updatedData.splitterPortIndex = sgpPort - 1;
            setSgpSuggestedPort(sgpPort - 1);
        } else {
            setSgpSuggestedPort(null);
        }

        // Sincronizar estados locais de conexão com os dados do SGP
        const finalCtoId = updatedData.ctoId || selectedCtoId;
        if (finalCtoId) {
            setSelectedCtoId(finalCtoId);
            
            // Se encontrou porta no SGP mas não há splitter selecionado localmente,
            // tenta selecionar o primeiro splitter da CTO que PERMITA conexões para mostrar a porta.
            if (updatedData.splitterPortIndex !== null && !selectedSplitterId) {
                const targetCto = ctos.find(c => c.id === finalCtoId);
                if (targetCto && targetCto.splitters && targetCto.splitters.length > 0) {
                    // Filtra apenas por splitters que permitam conexão
                    const validSplitters = targetCto.splitters.filter(s => s.allowCustomConnections !== false);
                    
                    if (validSplitters.length > 0) {
                        const firstSplitter = validSplitters[0];
                        setSelectedSplitterId(firstSplitter.id);
                        // Também atualizamos o formData para garantir consistência no salvamento
                        updatedData.splitterId = firstSplitter.id;
                    }
                }
            } else if (updatedData.splitterId) {
                setSelectedSplitterId(updatedData.splitterId);
            }
        }

        if (updatedData.splitterPortIndex !== null && updatedData.splitterPortIndex !== undefined) {
            setSelectedPortIndex(updatedData.splitterPortIndex);
        }
        
        // Re-alimentar formData com possíveis mudanças de auto-seleção de splitter
        setFormData(updatedData);

        // If we got new coordinates, notify parent to reposition marker
        if (onReposition && !formData.id && !isNaN(newLat) && !isNaN(newLng) && latStr !== "" && lngStr !== "") {
            onReposition(updatedData);
        }

        if (showToast && !silent) showToast(t('customer_imported_sgp') || "Cliente importado do SGP!", 'success');
        
        // Clear selection view
        setSgpServicesList([]);
        setSgpCustomerRaw(null);
    };

    const handleSgpSearch = async (silent = false) => {
        if (!formData.document || formData.document.length < 11) {
            if (showToast && !silent) showToast(t('invalid_document_error') || "Documento inválido", 'error');
            return;
        }

        setIsSearchingSgp(true);
        setSgpServicesList([]);
        setSgpCustomerRaw(null);
        try {
            const sgpCustomer = await searchSgpCustomer(formData.document);
            if (sgpCustomer) {
                // Collect all services
                const allServices: any[] = [];
                if (sgpCustomer.contratos && Array.isArray(sgpCustomer.contratos)) {
                    sgpCustomer.contratos.forEach((contrato: any) => {
                        if (contrato.servicos && Array.isArray(contrato.servicos)) {
                            contrato.servicos.forEach((servico: any) => {
                                allServices.push({ contrato, servico });
                            });
                        }
                    });
                }
                
                if (allServices.length > 1) {
                    // Show selection UI
                    setSgpCustomerRaw(sgpCustomer);
                    setSgpServicesList(allServices);
                    if (showToast && !silent) showToast("Cliente possui múltiplos contratos. Selecione um abaixo.", 'info');
                } else {
                    // Apply immediately if 1 or 0
                    const mainContract = sgpCustomer.contratos?.[0] || {};
                    const mainService = mainContract.servicos?.[0] || {};
                    applySgpService(sgpCustomer, mainContract, mainService, silent);
                }
            } else {
                if (showToast && !silent) showToast(t('customer_not_found_sgp') || "Cliente não encontrado no SGP", 'info');
            }
        } catch (error: any) {
            console.error("SGP Search error:", error);
            const errorMsg = error.response?.data?.error || t('customer_not_found_sgp') || "Cliente não encontrado no SGP";
            if (showToast && !silent) showToast(errorMsg, 'error');
            setSgpSearchError(error.message);
        } finally {
            setIsSearchingSgp(false);
        }
    };

    const selectedCto = useMemo(() => ctos.find(cto => cto.id === selectedCtoId), [ctos, selectedCtoId]);
    const splitters = useMemo(() => selectedCto?.splitters || [], [selectedCto]);
    const selectedSplitter = useMemo(() => splitters.find(s => s.id === selectedSplitterId), [splitters, selectedSplitterId]);

    const ports = useMemo(() => {
        if (!selectedSplitter) return [];

        const portCount = getSplitterPortCount(selectedSplitter);

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
            // Ensure address is a string for the backend if it's currently an object
            let finalAddress = formData.address;
            if (typeof formData.address === 'object' && formData.address !== null) {
                const addr = formData.address as any;
                finalAddress = `${addr.logradouro || ''}, ${addr.numero || ''} - ${addr.bairro || ''}, ${addr.cidade || ''} - ${addr.uf || ''}, ${addr.cep || ''}`;
                // Clean up double commas or spaces if fields were empty
                finalAddress = finalAddress.replace(/, ,/g, ',').replace(/^, /, '').replace(/ -  - /, ' - ').trim();
            }

            // Attachment fields follow the mode: in 'connector' mode we send the connectorId and
            // null out the splitter fields; in 'splitter' mode we do the opposite. The server also
            // enforces mutual exclusion, so both sides agree.
            const attachmentFields = attachmentMode === 'connector'
                ? { splitterId: null, splitterPortIndex: null, connectorId: selectedConnectorId }
                : { splitterId: selectedSplitterId, splitterPortIndex: selectedPortIndex, connectorId: null };

            await onSave({
                ...formData,
                address: finalAddress, // Use the processed address
                ctoId: selectedCtoId,
                ...attachmentFields,
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
        <>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] backdrop-blur-sm">
            <div 
                className="bg-white dark:bg-[#1a1d23] w-[600px] max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >


                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-[#22262e]/50">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <User className="w-5 h-5 text-indigo-500" />
                            {t('customer_modal_title')}
                        </h2>
                        {formData.connectionStatus && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                                String(formData.connectionStatus).toLowerCase() === 'online' 
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
                            }`}>
                                {String(formData.connectionStatus).toLowerCase() === 'online' ? 'Online' : 'Offline'}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex border-b border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab(TABS.DATA)}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === TABS.DATA
                            ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <FileText size={16} />
                        {t('customer_data')}
                    </button>
                    <button
                        onClick={() => setActiveTab(TABS.CONNECTION)}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === TABS.CONNECTION
                            ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <Network size={16} />
                        {t('customer_connection')} ({(selectedPortIndex !== null || selectedConnectorId) ? '1' : '0'})
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
                                            onuPower: c.onuPower,
                                            connectionStatus: c.connectionStatus
                                        }));
                                    }}
                                />
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <CustomInput
                                    label={`${t('customer_name')} *`}
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={t('customer_name')}
                                />
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <CustomInput
                                            label={t('customer_doc')}
                                            value={formData.document || ''}
                                            onChange={e => setFormData({ ...formData, document: e.target.value })}
                                            placeholder={t('customer_doc_placeholder') || 'CPF / CNPJ'}
                                        />
                                    </div>
                                    <div className="flex items-end pb-0.5">
                                        <button
                                            type="button"
                                            onClick={handleSgpSearch}
                                            disabled={isSearchingSgp}
                                            className={`p-2.5 rounded-lg border flex items-center justify-center transition-all ${isSearchingSgp
                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                                                : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                                }`}
                                            title="Buscar no SGP"
                                        >
                                            <Search className={`w-5 h-5 ${isSearchingSgp ? 'animate-pulse' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            {sgpServicesList.length > 0 && (
                                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl mb-4 animate-fade-in shadow-sm dark:bg-indigo-900/20 dark:border-indigo-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            Múltiplos Contratos no SGP
                                        </h4>
                                        <button 
                                            onClick={() => setSgpServicesList([])}
                                            className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                                            title="Cancelar"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <p className="text-xs text-indigo-600 dark:text-indigo-300 mb-3 font-medium">
                                        Foram encontrados múltiplos serviços para o cliente {sgpCustomerRaw?.nome}. Qual você deseja importar?
                                    </p>
                                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                                        {sgpServicesList.map((item, idx) => (
                                            <button
                                                key={`sgp-svc-${idx}`}
                                                type="button"
                                                onClick={() => applySgpService(sgpCustomerRaw, item.contrato, item.servico)}
                                                className="w-full text-left bg-white dark:bg-[#22262e] border border-indigo-100 dark:border-indigo-800 p-3 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md transition-all flex flex-col gap-1 group"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                                        Contrato {item.contrato.id || '-'}
                                                    </span>
                                                    {item.servico.status && (
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                            item.servico.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 
                                                            item.servico.status === 'Suspenso' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                            {item.servico.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    <span className="font-semibold text-slate-600 dark:text-slate-300">Plano:</span> {item.servico.plano?.nome || 'Não definido'}
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 mt-1 border-t border-slate-100 dark:border-slate-700 pt-2">
                                                    <div className="text-xs text-slate-500 truncate" title={item.servico.login}>
                                                        <span className="font-semibold">PPPoE:</span> {item.servico.login || '-'}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        <span className="font-semibold">MAC:</span> {item.servico.mac || item.servico.onu?.mac || '-'}
                                                    </div>
                                                </div>
                                                {(item.servico.endereco?.logradouro || item.contrato.endereco?.logradouro) && (
                                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-start gap-1">
                                                        <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                                        <span className="truncate">
                                                            {item.servico.endereco?.logradouro || item.contrato.endereco?.logradouro}, {item.servico.endereco?.numero || item.contrato.endereco?.numero}
                                                        </span>
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <CustomInput
                                    label={t('customer_phone')}
                                    value={formData.phone || ''}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder={t('customer_phone_placeholder') || '(00) 00000-0000'}
                                />
                                <CustomInput
                                    label={t('email')}
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder={t('customer_email_placeholder') || 'cliente@email.com'}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1.5 uppercase text-[10px] tracking-wider">{t('customer_address')}</label>
                                <div className="flex gap-2">
                                    <MapPin className="text-slate-400 mt-3" size={16} />
                                    <textarea
                                        value={typeof formData.address === 'object' && formData.address !== null 
                                            ? `${(formData.address as any).logradouro || ''}, ${(formData.address as any).numero || ''}${(formData.address as any).bairro ? ` - ${(formData.address as any).bairro}` : ''}` 
                                            : formData.address || ''}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        className="flex-1 px-4 py-2.5 bg-white dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
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

                            <CustomSelect
                                label={t('customer_status_title')}
                                value={formData.status || 'ACTIVE'}
                                onChange={val => setFormData({ ...formData, status: val as any })}
                                showSearch={false}
                                placement="top"
                                options={[
                                    { value: 'ACTIVE', label: t('customer_status_active') },
                                    { value: 'INACTIVE', label: t('customer_status_inactive') },
                                    { value: 'PLANNED', label: t('customer_status_planned') },
                                ]}
                            />
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
                                                setSelectedConnectorId(null);
                                            }}
                                            className="text-xs text-indigo-500 hover:underline"
                                        >
                                            {t('change')}
                                        </button>

                                        {/* Disconnect Option */}
                                        {!!formData.ctoId && (
                                            <button
                                                type="button"
                                                onClick={() => setShowDisconnectConfirm(true)}
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
                                                        setSelectedPortIndex(sgpSuggestedPort !== null ? sgpSuggestedPort : null);
                                                        setSelectedConnectorId(null);
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

                            {selectedCtoId && (() => {
                                // Connectors live in the CTO's fusions array with category='connector'.
                                const ctoConnectors = (selectedCto?.fusions || []).filter(f => f.category === 'connector');
                                return (
                                    <div className="space-y-4">
                                        {/* Attachment mode tabs */}
                                        <div className="flex bg-slate-100 dark:bg-[#22262e] p-1 rounded-lg gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAttachmentMode('splitter');
                                                    setSelectedConnectorId(null);
                                                }}
                                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                                                    attachmentMode === 'splitter'
                                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                }`}
                                            >
                                                <Network className="w-3.5 h-3.5" />
                                                {t('splitter') || 'Splitter'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAttachmentMode('connector');
                                                    setSelectedSplitterId(null);
                                                    setSelectedPortIndex(null);
                                                }}
                                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                                                    attachmentMode === 'connector'
                                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                }`}
                                            >
                                                <Zap className="w-3.5 h-3.5" />
                                                {t('connector') || 'Conector'} ({ctoConnectors.length})
                                            </button>
                                        </div>

                                        {attachmentMode === 'splitter' && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('select_splitter')}</label>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {splitters.length === 0 && <span className="text-sm text-slate-500 italic">{t('no_splitters_in_cto')}</span>}
                                                        {splitters.map(splitter => (
                                                            <button
                                                                key={splitter.id}
                                                                disabled={splitter.allowCustomConnections === false}
                                                                onClick={() => {
                                                                    setSelectedSplitterId(splitter.id);
                                                                    setSelectedPortIndex(sgpSuggestedPort !== null ? sgpSuggestedPort : null);
                                                                }}
                                                                title={splitter.allowCustomConnections === false ? (t('splitter_blocked_desc') || "Este splitter não permite conexão de clientes") : ""}
                                                                className={`px-3 py-1.5 rounded text-sm border transition-all ${selectedSplitterId === splitter.id
                                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                                    : splitter.allowCustomConnections === false
                                                                        ? 'bg-slate-100 dark:bg-[#22262e] border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed opacity-70'
                                                                        : 'bg-white dark:bg-[#22262e] border-slate-300 dark:border-slate-600 hover:bg-slate-50'
                                                                    } `}
                                                            >
                                                                {splitter.name} ({splitter.type})
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {selectedSplitterId && (
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-500 mb-1 flex justify-between items-center">
                                                            <span>{t('select_port')}</span>
                                                            {sgpSuggestedPort !== null && (
                                                                <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border border-indigo-200">
                                                                    SGP Sugere: Porta {sgpSuggestedPort + 1}
                                                                </span>
                                                            )}
                                                        </label>
                                                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                                                            {ports.map(port => (
                                                                <button
                                                                    key={port.index}
                                                                    disabled={port.occupied}
                                                                    onClick={() => setSelectedPortIndex(port.index)}
                                                                    className={`
                                                                        relative h-10 rounded border flex items-center justify-center text-sm font-bold transition-all
                                                                        ${port.occupied
                                                                            ? 'bg-slate-100 dark:bg-[#22262e] border-slate-200 text-slate-400 cursor-not-allowed'
                                                                            : selectedPortIndex === port.index
                                                                                ? 'bg-green-500 text-white border-green-600 shadow-md ring-2 ring-green-200 dark:ring-green-900'
                                                                                : port.index === sgpSuggestedPort
                                                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 text-indigo-700 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-100'
                                                                                    : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-green-400 hover:text-green-600'
                                                                        }
                                                                    `}
                                                                    title={port.occupied ? t('port_occupied_by', { name: port.occupantName || '' }) : t('port_free')}
                                                                >
                                                                    {port.index + 1}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {attachmentMode === 'connector' && (
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
                                                    <Zap className="w-3 h-3" />
                                                    {t('select_connector') || 'Selecionar Conector'}
                                                </label>
                                                {ctoConnectors.length === 0 ? (
                                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-sm rounded border border-yellow-200 dark:border-yellow-800">
                                                        {t('no_connectors_in_cto') || 'Esta CTO não possui conectores. Adicione um conector no editor da CTO.'}
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                                                        {ctoConnectors.map(conn => {
                                                            const occupant = allCustomers.find(c =>
                                                                c.ctoId === selectedCtoId &&
                                                                c.connectorId === conn.id &&
                                                                c.id !== formData.id
                                                            );
                                                            const isOccupied = !!occupant;
                                                            const isSelected = selectedConnectorId === conn.id;
                                                            const isAPC = conn.polishType === 'APC';
                                                            return (
                                                                <button
                                                                    key={conn.id}
                                                                    type="button"
                                                                    disabled={isOccupied}
                                                                    onClick={() => setSelectedConnectorId(conn.id)}
                                                                    title={isOccupied ? t('port_occupied_by', { name: occupant!.name }) : (conn.name || 'Conector')}
                                                                    className={`
                                                                        relative h-14 rounded border text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 px-1
                                                                        ${isOccupied
                                                                            ? 'bg-slate-100 dark:bg-[#22262e] border-slate-200 text-slate-400 cursor-not-allowed'
                                                                            : isSelected
                                                                                ? 'bg-green-500 text-white border-green-600 shadow-md ring-2 ring-green-200 dark:ring-green-900'
                                                                                : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-green-400 hover:text-green-600'
                                                                        }
                                                                    `}
                                                                >
                                                                    <span className={`w-2.5 h-2.5 rounded-[1px] ${isAPC ? 'bg-green-500' : 'bg-blue-500'}`} />
                                                                    <span className="truncate max-w-full leading-tight">{conn.name}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                    <User className="w-4 h-4 text-indigo-500" />
                                    {t('onu_data_section')}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="relative group">
                                        <CustomInput
                                            label={t('customer_document')}
                                            value={formData.document || ''}
                                            onChange={e => setFormData({ ...formData, document: e.target.value })}
                                            placeholder={t('customer_document_placeholder')}
                                            icon={FileText}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSgpSearch}
                                            disabled={isSearchingSgp || !formData.document}
                                            className="absolute right-2 top-[30px] p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-all disabled:opacity-50"
                                            title={t('search_in_sgp') || "Buscar no SGP"}
                                        >
                                            {isSearchingSgp ? (
                                                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Search className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    <CustomInput
                                        label={t('customer_phone')}
                                        value={formData.phone || ''}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="(00) 00000-0000"
                                        icon={Phone}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <CustomInput
                                        label={t('onu_serial')}
                                        value={formData.onuSerial || ''}
                                        onChange={e => setFormData({ ...formData, onuSerial: e.target.value })}
                                        placeholder={t('onu_serial_placeholder') || 'Ex: ZTEG12345678'}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <CustomInput
                                            label={t('pppoe_user')}
                                            value={formData.pppoeService || ''}
                                            onChange={e => setFormData({ ...formData, pppoeService: e.target.value })}
                                            placeholder={t('pppoe_user_placeholder') || 'usuario@pppoe'}
                                        />
                                        <CustomInput
                                            label={t('onu_mac')}
                                            value={formData.onuMac || ''}
                                            onChange={e => {
                                                let value = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '');
                                                if (value.length > 12) value = value.substring(0, 12);
                                                const parts = value.match(/.{1,2}/g) || [];
                                                const masked = parts.join(':');
                                                setFormData({ ...formData, onuMac: masked });
                                            }}
                                            placeholder="00:00:00:00:00:00"
                                            maxLength={17}
                                            className="font-mono"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <CustomInput
                                            label={t('onu_power')}
                                            value={formData.onuPower || ''}
                                            onChange={e => setFormData({ ...formData, onuPower: e.target.value })}
                                            placeholder="-20.50"
                                        />
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t('drop_length')}</label>
                                            <div className="flex gap-2">
                                                <div className="flex-1 p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1a1d23]/50 text-sm text-slate-600 dark:text-slate-400">
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

                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#22262e]/50 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || !formData.name}
                        className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold transition"
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

        {/* Disconnect Confirmation Modal */}
        {showDisconnectConfirm && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0 border border-red-100 dark:border-red-500/30">
                            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('disconnect') || 'Desconectar'}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                {t('confirm_disconnect') || 'Tem certeza que deseja desconectar este cliente? Isso removerá o cabo e a conexão.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end mt-6">
                        <button
                            onClick={() => setShowDisconnectConfirm(false)}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={() => {
                                setFormData(prev => ({
                                    ...prev,
                                    ctoId: null,
                                    splitterId: null,
                                    splitterPortIndex: null,
                                    connectorId: null
                                }));
                                setSelectedCtoId(null);
                                setSelectedSplitterId(null);
                                setSelectedPortIndex(null);
                                setSelectedConnectorId(null);
                                setShowDisconnectConfirm(false);
                            }}
                            className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-lg shadow-red-900/20 transition-all active:scale-95"
                        >
                            {t('disconnect') || 'Desconectar'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
