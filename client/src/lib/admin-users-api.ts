export async function deleteUserAccountAsAdmin(params: {
  accessToken: string;
  userId: string;
}): Promise<void> {
  const res = await fetch(`/v1/admin/users/${encodeURIComponent(params.userId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${params.accessToken}` },
    credentials: "include",
  });

  if (res.ok) {
    return;
  }

  let message = "Unable to delete user";
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    if (typeof j?.error?.message === "string" && j.error.message.trim()) {
      message = j.error.message;
    }
  } catch {
    /* ignore */
  }
  throw new Error(message);
}
