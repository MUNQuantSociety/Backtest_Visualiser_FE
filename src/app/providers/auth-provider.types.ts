import { type ReactNode } from 'react';

export interface AuthProviderProps {
    children: ReactNode;
}

export type AuthState = { isAuthenticated: false } | { isAuthenticated: true; token: string };

export interface AuthCtxInterface {
    authState: AuthState;
    login: (token: string) => void;
    logout: () => void;
}
