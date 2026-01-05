import api from './api';
import { User } from '../types';

export interface AdminUser {
    id: string;
    username: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    createdAt: string;
}

export interface CreateUserDto {
    username: string;
    password?: string;
    role?: string;
}

// Get Users
export const getUsers = async (): Promise<AdminUser[]> => {
    const response = await api.get('/admin/users');
    return response.data;
};

// Create User
export const createUser = async (data: CreateUserDto): Promise<AdminUser> => {
    const response = await api.post('/admin/users', data);
    return response.data;
};

// Update User
export const updateUser = async (id: string, data: Partial<CreateUserDto>): Promise<AdminUser> => {
    const response = await api.put(`/admin/users/${id}`, data);
    return response.data;
};

// Delete User
export const deleteUser = async (id: string): Promise<void> => {
    await api.delete(`/admin/users/${id}`);
};
