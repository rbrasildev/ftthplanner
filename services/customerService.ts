import api from './api';
import { Customer } from '../types';

export const getCustomers = async (params?: {
    minLat?: number, maxLat?: number, minLng?: number, maxLng?: number,
    ctoId?: string,
    search?: string
}) => {
    const response = await api.get<Customer[]>('/customers', { params });
    return response.data;
};

export const createCustomer = async (data: Partial<Customer>) => {
    const response = await api.post<Customer>('/customers', data);
    return response.data;
};

export const updateCustomer = async (id: string, data: Partial<Customer>) => {
    const response = await api.put<Customer>(`/customers/${id}`, data);
    return response.data;
};

export const deleteCustomer = async (id: string) => {
    const response = await api.delete<void>(`/customers/${id}`);
    return response.data;
};
