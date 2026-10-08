import { env } from '@/config/env';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

interface LoginErrorResponse {
  detail?: string;
  message?: string;
}

export async function apiLogin(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  const url = `${env.apiBaseUrl}/auth/login/`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error('Unable to sign in. Please try again.');
    }

    throw new Error('The server returned an invalid response.');
  }

  if (!response.ok) {
    const error = data as LoginErrorResponse;

    throw new Error(
      error.detail ??
        error.message ??
        'Unable to sign in. Please check your email and password.',
    );
  }

  return data as LoginResponse;
}
