import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { AUTH_CONFIG } from "@/config/auth";
import {
  reportClientError,
  shouldSkipClientErrorReportingForUrl,
} from "@/lib/report-client-error";

async function throwIfResNotOk(res: Response, requestUrl: string) {
  if (res.status === 401 || res.status === 403) {
    // Session expired or unauthorized - clear cache and redirect
    if (typeof window !== "undefined") {
      queryClient.clear();
      window.location.href = AUTH_CONFIG.LOGIN_PATH;
    }
    return;
  }

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    if (
      typeof window !== "undefined" &&
      res.status !== 404 &&
      !shouldSkipClientErrorReportingForUrl(requestUrl)
    ) {
      reportClientError({
        source: `api.http.${res.status}`,
        message: `${res.status}: ${text.slice(0, 2000)}`,
        payload: {
          path: requestUrl,
          status: res.status,
        },
      });
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  headers?: HeadersInit,
  signal?: AbortSignal,
): Promise<Response> {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal,
    });

    await throwIfResNotOk(res, url);
    return res;
  } catch (error) {
    if (
      typeof window !== "undefined" &&
      !shouldSkipClientErrorReportingForUrl(url) &&
      !(error instanceof Error && /^\d{3}: /.test(error.message))
    ) {
      reportClientError({
        source: "api.fetch.failed",
        message: error instanceof Error ? error.message : String(error),
        payload: { path: url, method },
      });
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res, queryKey.join("/") as string);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
