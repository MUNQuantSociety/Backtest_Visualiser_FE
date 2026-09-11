import { type ReactNode } from 'react';

export interface AuthProviderProps {
  children: ReactNode;
}

/** Local UI sign-in state until backend session authentication is connected. */
export interface AuthState {
  isAuthenticated: boolean;
}

export interface AuthCtxInterface {
  authState: AuthState;
  login: () => void;
  logout: () => void;
}
