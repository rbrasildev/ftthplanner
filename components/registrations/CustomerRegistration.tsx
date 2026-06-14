import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User, Search, Edit2, Trash2, X, Save, Loader2, MapPin, Phone, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { CustomSelect, CustomInput } from '../common';
import { getCustomers, updateCustomer, deleteCustomer } from '../../services/customerService';
import { Customer, PaginatedResponse, CustomerStatus } from '../../types';
import {
    KebabMenu, DeleteConfirmDialog, EmptyState, FilterChips,
    ListSkeleton, ModalFooter,
} from './common/CatalogPrimitives';

interface CustomerRegistrationProps {
    onLocate?: (customer: Customer) => void;
    projectId?: string;
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const CustomerRegistration: React.FC<CustomerRegistrationProps> = ({ onLocate, projectId, showToast }) => {
    const { t } = useLanguage();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<CustomerStatus | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // Pagination State
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Form State
    const [formData, setFormData] = useState<Partial<Customer>>({
        name: '',
        document: '',
        phone: '',
        email: '',
        address: '',
        status: 'ACTIVE'
    });

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to first page on new search
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        loadCustomers();
    }, [projectId, page, debouncedSearch]);

    const loadCustomers = async () => {
        setIsLoading(true);
        try {
            const result = await getCustomers({ 
                projectId, 
                page, 
                limit: pageSize,
                search: debouncedSearch 
            });

            if (Array.isArray(result)) {
                setCustomers(result);
                setTotal(result.length);
                setTotalPages(1);
            } else {
                const paginated = result as PaginatedResponse<Customer>;
                setCustomers(paginated.data || []);
                setTotal(paginated.total || 0);
                setTotalPages(paginated.totalPages || 1);
            }
        } catch (error) {
            console.error("Failed to load customers", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (customer?: Customer) => {
        if (customer) {
            setEditingCustomer(customer);
            setFormData({ ...customer });
        } else {
            setEditingCustomer(null);
            setFormData({
                name: '',
                document: '',
                phone: '',
                email: '',
                address: '',
                status: 'ACTIVE'
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCustomer(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingCustomer) {
                await updateCustomer(editingCustomer.id, formData);
                loadCustomers();
                handleCloseModal();
                if (showToast) showToast(t('toast_updated_success') || 'Atualizado com sucesso', 'success');
            }
        } catch (error) {
            console.error("Failed to save customer", error);
            if (showToast) showToast(t('error_save') || 'Falha ao salvar cliente', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Filtra por status no client-side (em cima da página atual).
    const filteredCustomers = useMemo(() => {
        if (!statusFilter) return customers;
        return customers.filter(c => c.status === statusFilter);
    }, [customers, statusFilter]);

    const statusChips = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const c of customers) counts[c.status] = (counts[c.status] || 0) + 1;
        return [
            { value: null, label: 'Todos', count: customers.length },
            ...(['ACTIVE', 'PLANNED', 'SUSPENDED', 'INACTIVE', 'CANCELLED'] as CustomerStatus[])
                .filter(s => counts[s] > 0)
                .map(s => ({
                    value: s,
                    label: s === 'ACTIVE' ? 'Ativos'
                        : s === 'PLANNED' ? 'Planejados'
                        : s === 'SUSPENDED' ? 'Suspensos'
                        : s === 'CANCELLED' ? 'Cancelados'
                        : 'Inativos',
                    count: counts[s],
                })),
        ];
    }, [customers]);

    const itemToDelete = customers.find(c => c.id === showDeleteConfirm);

    const handleDelete = async (id: string) => {
        try {
            await deleteCustomer(id);
            setCustomers(prev => prev.filter(c => c.id !== id));
            setShowDeleteConfirm(null);
            setTotal(prev => prev - 1);
            if (showToast) showToast(t('toast_deleted_success') || 'Excluído com sucesso', 'success');
        } catch (error) {
            console.error("Failed to delete customer", error);
            if (showToast) showToast(t('error_delete') || 'Falha ao excluir cliente', 'error');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <User className="w-7 h-7 text-emerald-500" />
                        {t('reg_clientes') || 'Clientes'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('manage_customers_desc') || 'Gerencie a base de dados de clientes e suas conexões.'}
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/30 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                        <div className="relative max-w-md flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="text" placeholder={t('search_placeholder') || 'Buscar por nome, email, telefone...'}
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-[#f9fafb] dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700/30 focus:outline-none focus:border-emerald-500 transition-colors text-sm" />
                        </div>
                        {total > 0 && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                                {t('customers_total', { count: total })}
                            </div>
                        )}
                    </div>
                    {!isLoading && customers.length > 0 && (
                        <FilterChips options={statusChips} value={statusFilter} onChange={(v) => setStatusFilter(v as CustomerStatus | null)} />
                    )}
                </div>

                {isLoading && page === 1 ? (
                    <ListSkeleton rows={6} />
                ) : filteredCustomers.length === 0 ? (
                    <EmptyState
                        icon={User}
                        title={customers.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado'}
                        description={customers.length === 0 ? 'Os clientes adicionados pelo mapa aparecem aqui pra gestão.' : undefined}
                        searchTerm={customers.length > 0 && (debouncedSearch || statusFilter) ? (debouncedSearch || `status: ${statusFilter}`) : undefined}
                    />
                ) : (
                    <div className="relative overflow-x-auto">
                        {isLoading && (
                            <div className="absolute inset-0 bg-white/60 dark:bg-[#1a1d23]/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                            </div>
                        )}
                        <table className="w-full text-left text-sm min-w-[800px]">
                            <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px]">
                                <tr>
                                    <th className="px-6 py-3">{t('name')}</th>
                                    <th className="px-6 py-3">{t('contacts')}</th>
                                    <th className="px-6 py-3">{t('status')}</th>
                                    <th className="px-6 py-3">{t('customer_connection')}</th>
                                    <th className="px-6 py-3 text-right w-12">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredCustomers.map(customer => (
                                    <tr key={customer.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-3 font-semibold text-slate-900 dark:text-white">
                                            <div className="flex flex-col">
                                                <span>{customer.name}</span>
                                                <span className="text-[10px] text-slate-400 tabular-nums uppercase font-normal">{customer.document || '—'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col gap-1 text-slate-500 dark:text-slate-400 text-xs">
                                                {customer.phone && <div className="flex items-center gap-1.5 tabular-nums"><Phone className="w-3 h-3" /> {customer.phone}</div>}
                                                {customer.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {customer.email}</div>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                customer.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                                                customer.status === 'SUSPENDED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                                customer.status === 'INACTIVE' ? 'bg-[#BFAA0F]/15 text-[#8a7a0a] dark:bg-[#BFAA0F]/20 dark:text-[#d9c43c]' :
                                                customer.status === 'CANCELLED' ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
                                                'bg-slate-100 text-slate-700 dark:bg-[#22262e] dark:text-slate-300'
                                                }`}>
                                                {customer.status === 'ACTIVE' ? t('customer_status_active') :
                                                    customer.status === 'SUSPENDED' ? 'Suspenso' :
                                                    customer.status === 'INACTIVE' ? t('customer_status_inactive') :
                                                    customer.status === 'CANCELLED' ? 'Cancelado' :
                                                    t('customer_status_planned')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            {customer.ctoId ? (
                                                <div className="flex flex-col">
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase">Conectado</span>
                                                    <span className="text-[10px] text-slate-400 tabular-nums">ID: {customer.ctoId.slice(0, 8)}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic text-xs">Não conectado</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <KebabMenu actions={[
                                                ...(onLocate ? [{ label: t('locate_on_map') || 'Localizar no mapa', icon: MapPin, onClick: () => onLocate(customer) }] : []),
                                                { label: t('edit') || 'Editar', icon: Edit2, onClick: () => handleOpenModal(customer) },
                                                { label: t('delete') || 'Excluir', icon: Trash2, onClick: () => setShowDeleteConfirm(customer.id), destructive: true },
                                            ]} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination Footer */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-700/30 flex items-center justify-between bg-slate-50/50 dark:bg-[#22262e]/20">
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('page') || 'Página'} {page} {t('of') || 'de'} {totalPages}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a1d23] text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                            let pageNum = page;
                                            if (totalPages <= 5) pageNum = i + 1;
                                            else if (page <= 3) pageNum = i + 1;
                                            else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                                            else pageNum = page - 2 + i;
                                            
                                            if (pageNum < 1 || pageNum > totalPages) return null;

                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setPage(pageNum)}
                                                    className={`min-w-[32px] h-8 text-xs font-bold rounded-lg transition-colors ${page === pageNum 
                                                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' 
                                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        disabled={page === totalPages}
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a1d23] text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <DeleteConfirmDialog
                isOpen={!!showDeleteConfirm}
                itemType="cliente"
                itemLabel={itemToDelete?.name || ''}
                hint="O cliente será removido do projeto. A conexão de fibra associada permanece."
                onCancel={() => setShowDeleteConfirm(null)}
                onConfirm={() => handleDelete(showDeleteConfirm!)}
            />

            {/* Modal for Editing Basic Info */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 translate-y-0 border border-slate-200 dark:border-slate-700/30">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700/30">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <User className="w-6 h-6 text-emerald-500" />
                                {t('edit_customer')}
                            </h2>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <CustomInput
                                label={t('name')}
                                required
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <CustomInput
                                    label={t('customer_doc')}
                                    value={formData.document || ''}
                                    onChange={e => setFormData({ ...formData, document: e.target.value })}
                                />
                                <CustomSelect
                                    label={t('customer_status_title')}
                                    value={formData.status || 'ACTIVE'}
                                    options={[
                                        { value: 'ACTIVE', label: t('customer_status_active') },
                                        { value: 'SUSPENDED', label: 'Suspenso' },
                                        { value: 'INACTIVE', label: t('customer_status_inactive') },
                                        { value: 'CANCELLED', label: 'Cancelado' },
                                    ]}
                                    onChange={val => setFormData({ ...formData, status: val as any })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <CustomInput
                                    label={t('customer_phone')}
                                    value={formData.phone || ''}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                                <CustomInput
                                    label={t('email')}
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <CustomInput
                                isTextarea
                                label={t('customer_address')}
                                value={formData.address || ''}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                rows={2}
                            />

                            <ModalFooter
                                onCancel={handleCloseModal}
                                primaryLabel={t('save')}
                                primaryIcon={Save}
                                primaryType="submit"
                                primaryDisabled={saving}
                                primaryLoading={saving}
                            />
                        </form>
                    </div>
                </div>
            , document.body)}
        </div>
    );
};

export default CustomerRegistration;
