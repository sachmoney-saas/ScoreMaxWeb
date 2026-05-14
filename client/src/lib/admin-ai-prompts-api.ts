export type AdminAiImagePrompt = {
  key: string;
  description: string | null;
  prompt: string;
  model: string;
  model_variant: string;
  aspect_ratio: string;
  safety_filters: boolean;
  is_active: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminAiImagePromptPatch = {
  prompt?: string;
  model_variant?: string;
  aspect_ratio?: string;
  safety_filters?: boolean;
  is_active?: boolean;
};

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    if (typeof json?.error?.message === "string" && json.error.message.trim()) {
      return json.error.message;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export async function listAdminAiImagePrompts(params: {
  accessToken: string;
}): Promise<AdminAiImagePrompt[]> {
  const res = await fetch("/v1/admin/ai-image-prompts", {
    headers: { Authorization: `Bearer ${params.accessToken}` },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Unable to load prompts"));
  }
  const json = (await res.json()) as { data?: { prompts?: AdminAiImagePrompt[] } };
  return json.data?.prompts ?? [];
}

export async function updateAdminAiImagePrompt(params: {
  accessToken: string;
  key: string;
  patch: AdminAiImagePromptPatch;
}): Promise<AdminAiImagePrompt> {
  const res = await fetch(
    `/v1/admin/ai-image-prompts/${encodeURIComponent(params.key)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(params.patch),
    },
  );
  if (!res.ok) {
    throw new Error(await readError(res, "Unable to update prompt"));
  }
  const json = (await res.json()) as { data?: { prompt?: AdminAiImagePrompt } };
  if (!json.data?.prompt) {
    throw new Error("Missing prompt in response");
  }
  return json.data.prompt;
}
