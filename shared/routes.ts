import { z } from 'zod';
import { insertProfileSchema } from './schema';
import {
  analysesRequestSchema,
  analysesResponseSchema,
  createApiKeyRequestSchema,
  createApiKeyResponseSchema,
  createJobRequestSchema,
  createJobResponseSchema,
  getJobResponseSchema,
  listApiKeysResponseSchema,
  oneshotApiErrorSchema,
  publicUiModeResponseSchema,
  recentRequestsResponseSchema,
  revokeApiKeyResponseSchema,
} from './oneshot';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  health: {
    method: 'GET' as const,
    path: '/api/health',
    responses: {
      200: z.object({ status: z.string() }),
    },
  },
  profiles: {
    get: {
      method: 'GET' as const,
      path: '/api/profiles/:id',
      responses: {
        200: insertProfileSchema,
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/profiles/:id',
      responses: {
        200: insertProfileSchema,
        400: errorSchemas.validation,
      },
    },
  },
  oneshot: {
    analyses: {
      method: 'POST' as const,
      path: '/v1/analyses',
      body: analysesRequestSchema,
      responses: {
        200: analysesResponseSchema,
        400: oneshotApiErrorSchema,
        401: oneshotApiErrorSchema,
        403: oneshotApiErrorSchema,
        413: oneshotApiErrorSchema,
        500: oneshotApiErrorSchema,
      },
    },
    jobs: {
      create: {
        method: 'POST' as const,
        path: '/v1/jobs',
        body: createJobRequestSchema,
        responses: {
          202: createJobResponseSchema,
          400: oneshotApiErrorSchema,
          401: oneshotApiErrorSchema,
          403: oneshotApiErrorSchema,
          500: oneshotApiErrorSchema,
        },
      },
      get: {
        method: 'GET' as const,
        path: '/v1/jobs/:id',
        responses: {
          200: getJobResponseSchema,
          400: oneshotApiErrorSchema,
          401: oneshotApiErrorSchema,
          403: oneshotApiErrorSchema,
          500: oneshotApiErrorSchema,
        },
      },
    },
    public: {
      uiMode: {
        method: 'GET' as const,
        path: '/v1/public/ui-mode',
        responses: {
          200: publicUiModeResponseSchema,
          500: oneshotApiErrorSchema,
        },
      },
      recentRequests: {
        method: 'GET' as const,
        path: '/v1/public/recent-requests',
        responses: {
          200: recentRequestsResponseSchema,
          400: oneshotApiErrorSchema,
          500: oneshotApiErrorSchema,
        },
      },
    },
    admin: {
      apiKeys: {
        list: {
          method: 'GET' as const,
          path: '/v1/admin/api-keys',
          responses: {
            200: listApiKeysResponseSchema,
            403: oneshotApiErrorSchema,
            500: oneshotApiErrorSchema,
          },
        },
        create: {
          method: 'POST' as const,
          path: '/v1/admin/api-keys',
          body: createApiKeyRequestSchema,
          responses: {
            201: createApiKeyResponseSchema,
            400: oneshotApiErrorSchema,
            403: oneshotApiErrorSchema,
            500: oneshotApiErrorSchema,
          },
        },
        revoke: {
          method: 'POST' as const,
          path: '/v1/admin/api-keys/:id/revoke',
          responses: {
            200: revokeApiKeyResponseSchema,
            400: oneshotApiErrorSchema,
            403: oneshotApiErrorSchema,
            500: oneshotApiErrorSchema,
          },
        },
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
