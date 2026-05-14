import { useState, useEffect, useCallback, useMemo } from 'react';

export interface CatalogService<T> {
    list: () => Promise<T[]>;
    create: (data: any) => Promise<T>;
    update: (id: string, data: any) => Promise<T>;
    remove: (id: string) => Promise<void>;
}

interface UseCatalogRegistrationOptions<T> {
    service: CatalogService<T>;
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
    /** Mensagens de toast (texto cru, sem chamada t(...)). Cada componente mantém suas próprias chaves. */
    messages?: {
        created?: string;
        updated?: string;
        deleted?: string;
        errorLoad?: string;
        errorSave?: string;
        errorDelete?: string;
    };
    /** Filtro de busca aplicado sobre `items`. Cada componente decide quais campos comparar. */
    filterFn?: (item: T, searchTerm: string) => boolean;
}

export interface UseCatalogRegistrationResult<T extends { id: string }> {
    /** Lista carregada do backend (atualizada otimisticamente em save/delete). */
    items: T[];
    /** Lista após `filterFn` aplicado a `searchTerm`. */
    filteredItems: T[];

    loading: boolean;
    saving: boolean;

    searchTerm: string;
    setSearchTerm: (s: string) => void;

    isModalOpen: boolean;
    editingItem: T | null;
    openCreate: () => void;
    openEdit: (item: T) => void;
    closeModal: () => void;

    showDeleteConfirm: string | null;
    setShowDeleteConfirm: (id: string | null) => void;

    /** Salva (create ou update conforme `editingItem`). Retorna true em sucesso. */
    save: (payload: any) => Promise<boolean>;
    confirmDelete: () => Promise<void>;
    reload: () => Promise<void>;
}

/**
 * Centraliza o esqueleto compartilhado pelos 9 componentes de Registration:
 * fetch inicial, estado de busca/modal/edit/delete, save (create|update) e
 * delete — tudo com toasts opcionais e atualização otimista da lista local.
 *
 * O componente continua dono do form (cada catálogo tem campos diferentes) —
 * só passa o payload já validado pra `save()`.
 */
export function useCatalogRegistration<T extends { id: string }>(
    opts: UseCatalogRegistrationOptions<T>
): UseCatalogRegistrationResult<T> {
    const { service, showToast, messages = {}, filterFn } = opts;

    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<T | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const data = await service.list();
            setItems(data);
        } catch (error) {
            console.error('Failed to load catalog', error);
            if (showToast && messages.errorLoad) showToast(messages.errorLoad, 'error');
        } finally {
            setLoading(false);
        }
    }, [service, showToast, messages.errorLoad]);

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openCreate = useCallback(() => {
        setEditingItem(null);
        setIsModalOpen(true);
    }, []);

    const openEdit = useCallback((item: T) => {
        setEditingItem(item);
        setIsModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingItem(null);
    }, []);

    const save = useCallback(async (payload: any): Promise<boolean> => {
        setSaving(true);
        try {
            if (editingItem) {
                const updated = await service.update(editingItem.id, payload);
                setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
                if (showToast && messages.updated) showToast(messages.updated, 'success');
            } else {
                const created = await service.create(payload);
                setItems(prev => [...prev, created]);
                if (showToast && messages.created) showToast(messages.created, 'success');
            }
            closeModal();
            return true;
        } catch (error) {
            console.error('Failed to save catalog item', error);
            if (showToast && messages.errorSave) showToast(messages.errorSave, 'error');
            return false;
        } finally {
            setSaving(false);
        }
    }, [editingItem, service, showToast, messages.updated, messages.created, messages.errorSave, closeModal]);

    const confirmDelete = useCallback(async () => {
        if (!showDeleteConfirm) return;
        try {
            await service.remove(showDeleteConfirm);
            setItems(prev => prev.filter(i => i.id !== showDeleteConfirm));
            setShowDeleteConfirm(null);
            if (showToast && messages.deleted) showToast(messages.deleted, 'success');
        } catch (error) {
            console.error('Failed to delete catalog item', error);
            if (showToast && messages.errorDelete) showToast(messages.errorDelete, 'error');
        }
    }, [showDeleteConfirm, service, showToast, messages.deleted, messages.errorDelete]);

    const filteredItems = useMemo(() => {
        if (!filterFn || !searchTerm.trim()) return items;
        return items.filter(i => filterFn(i, searchTerm));
    }, [items, filterFn, searchTerm]);

    return {
        items,
        filteredItems,
        loading,
        saving,
        searchTerm,
        setSearchTerm,
        isModalOpen,
        editingItem,
        openCreate,
        openEdit,
        closeModal,
        showDeleteConfirm,
        setShowDeleteConfirm,
        save,
        confirmDelete,
        reload,
    };
}
