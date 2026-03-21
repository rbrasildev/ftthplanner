import React, { useState, useEffect } from 'react';
import { User, Search, Edit2, Trash2, X, Save, AlertTriangle, Loader2, MapPin, Phone, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { CustomSelect, CustomInput } from '../common';
import { getCustomers, updateCustomer, deleteCustomer } from '../../services/customerService';
import { Customer, PaginatedResponse } from '../../types';

interface CustomerRegistrationProps {
    onLocate?: (customer: Customer) => void;
    projectId?: string;
}

const CustomerRegistration: React.FC<CustomerRegistrationProps> = ({ onLocate, projectId }) => {
    const { t } = useLanguage();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [isLoading, setIsLoading] = useState(false);
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
        try {
            if (editingCustomer) {
                await updateCustomer(editingCustomer.id, formData);
                loadCustomers();
                handleCloseModal();
            }
        } catch (error) {
            console.error("Failed to save customer", error);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteCustomer(id);
            setCustomers(prev => prev.filter(c => c.id !== id));
            setShowDeleteConfirm(null);
            setTotal(prev => prev - 1);
        } catch (error) {
            console.error("Failed to delete customer", error);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
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

            {/* List Container */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                    <div className="relative max-w-md flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('search_placeholder') || 'Buscar...'}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                        />
                    </div>
                    
                    {total > 0 && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {t('customers_total', { count: total })}
                        </div>
                    )}
                </div>

                {isLoading && page === 1 ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    </div>
                ) : customers.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        {t('no_customers_found') || 'Nenhum cliente encontrado'}
                    </div>
                ) : (
                    <div className="relative overflow-x-auto">
                        {isLoading && (
                            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                            </div>
                        )}
                        <table className="w-full text-left text-sm min-w-[800px]">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4">{t('name')}</th>
                                    <th className="px-6 py-4">{t('contacts')}</th>
                                    <th className="px-6 py-4">{t('status')}</th>
                                    <th className="px-6 py-4">{t('customer_connection')}</th>
                                    <th className="px-6 py-4 text-right">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {customers.map(customer => (
                                    <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                            <div className="flex flex-col">
                                                <span>{customer.name}</span>
                                                <span className="text-[10px] text-slate-400 font-mono uppercase">{customer.document || '---'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 text-slate-500 dark:text-slate-400 text-xs">
                                                {customer.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {customer.phone}</div>}
                                                {customer.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {customer.email}</div>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${customer.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                                                customer.status === 'INACTIVE' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
                                                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                }`}>
                                                {customer.status === 'ACTIVE' ? t('customer_status_active') :
                                                    customer.status === 'INACTIVE' ? t('customer_status_inactive') :
                                                        t('customer_status_planned')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {customer.ctoId ? (
                                                <div className="flex flex-col">
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase">{t('status_DEPLOYED')}</span>
                                                    <span className="text-[10px] text-slate-400">ID: {customer.ctoId}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic text-xs">{t('status_PLANNED')}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {onLocate && (
                                                    <button
                                                        onClick={() => onLocate(customer)}
                                                        className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                        title={t('locate_on_map')}
                                                    >
                                                        <MapPin className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleOpenModal(customer)}
                                                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                    title={t('edit')}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(customer.id)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title={t('delete')}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination Footer */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('page') || 'Página'} {page} {t('of') || 'de'} {totalPages}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
                                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Overlay */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 max-w-sm w-full text-center animate-in zoom-in-95 duration-200">
                        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t('confirm_delete')}</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{t('confirm_delete_customer')}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 py-2 px-4 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition font-medium"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={() => handleDelete(showDeleteConfirm!)}
                                className="flex-1 py-2 px-4 rounded-lg bg-red-600 text-white hover:bg-red-700 transition font-medium shadow-md shadow-red-500/20"
                            >
                                {t('delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Editing Basic Info */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 translate-y-0 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
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
                                        { value: 'INACTIVE', label: t('customer_status_inactive') },
                                        { value: 'PLANNED', label: t('customer_status_planned') }
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

                            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shadow-lg shadow-emerald-200/50 transition active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerRegistration;
