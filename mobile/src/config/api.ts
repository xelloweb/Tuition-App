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

export async function apiRequest<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers = {}, ...rest } = options;

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
      const message = data.message || data.error || `Request failed with status ${res.status}`;
      throw new Error(message);
    }

    return data;
  } catch (err: any) {
    console.error(`API Error on [${endpoint}]:`, err.message);
    throw err;
  }
}
