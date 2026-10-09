/**
 * API configuration for Xello Tuition Mobile App.
 * Automatically handles localhost / production and provides type-safe fetch helpers.
 */
import { Platform } from "react-native";

// In development, Android emulator uses 10.0.2.2 to access host machine; iOS uses localhost
const DEV_URL = Platform.select({
  android: "http://10.0.2.2:3000",
  ios: "http://localhost:3000",
  default: "http://localhost:3000",
});

export const API_BASE_URL = __DEV__ ? DEV_URL : "https://xellotuition.com";

interface FetchOptions extends RequestInit {
  token?: string | null;
}

// The signed-in token, set by AuthContext, is sent with every request: the
// server answers nothing without it.
let sessionToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionToken(token: string | null) {
  sessionToken = token;
}

/** Called when the server refuses the token (expired, password changed, account turned off). */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

export async function apiRequest<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token: explicitToken, headers = {}, ...rest } = options;
  const token = explicitToken ?? sessionToken;

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...rest,
      headers: {
        ...defaultHeaders,
        ...(headers as Record<string, string>),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Only the phone app's own endpoints read the token, so only their 401 means "signed out".
      if (res.status === 401 && token && endpoint.startsWith("/api/mobile/") && onSessionExpired) onSessionExpired();
      const message = data.message || data.error || `Request failed with status ${res.status}`;
      // Keep the server's code and details (e.g. a confirmation the person must give).
      throw Object.assign(new Error(message), { status: res.status, code: data.code, details: data.details });
    }

    return data;
  } catch (err: any) {
    console.error(`API Error on [${endpoint}]:`, err.message);
    throw err;
  }
}
