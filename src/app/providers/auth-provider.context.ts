import { createContext, useContext } from 'react';

import type { AuthCtxInterface } from './auth-provider.types';

export const AuthCtx = createContext<AuthCtxInterface | undefined>(undefined);

export const useAuthCtx = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    throw new Error('You are doing nonsense, stop! use auth context within auth provider');
  }

  return ctx;
};
