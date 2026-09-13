import { type ReactNode } from 'react';

export interface AuthProviderProps {
  children: ReactNode;
}

export interface AppUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

export interface AuthState {
  status: 'loading' | 'signed-out' | 'authenticated' | 'error';
  isAuthenticated: boolean;
  user: AppUser | null;
  error: string | null;
}

export interface AuthCtxInterface {
  authState: AuthState;
  login: (returnTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  completeSignIn: () => Promise<string>;
}
