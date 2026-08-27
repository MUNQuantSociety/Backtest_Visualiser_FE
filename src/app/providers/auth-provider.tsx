import { useState } from 'react';

import { AuthCtx } from './auth-provider.context';
import type { AuthProviderProps, AuthState, AuthCtxInterface } from './auth-provider.types';

export function AuthProvider({ children }: AuthProviderProps) {
    const [authState, setAuthState] = useState<AuthState>({
        isAuthenticated: false,
    });

    /*
     * Internal login function
     * Intentionally designed this way not to expose the set function itself
     * Could extend by adding other chain of events
     * Intentional kept DUMB!
     * */
    const login = (token: string): void => {
        setAuthState({
            isAuthenticated: true,
            token,
        });
    };

    const logout = (): void => {
        setAuthState({
            isAuthenticated: false,
        });
    };

    // TODO: Fetch token on mount
    // useEffect(() => {
    //
    // }, []);
    //
    const value: AuthCtxInterface = {
        authState,
        login,
        logout,
    };

    return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
