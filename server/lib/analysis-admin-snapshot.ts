/** Payload stocké en base : même structure mais `images[].base64` remplacé par `base64_length`. */
export function summarizeStoredAnalysisRequestPayloadForAdmin(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const clone = { ...(payload as Record<string, unknown>) };
  const images = clone.images;
  if (!Array.isArray(images)) {
    return clone;
  }

  clone.images = images.map((img) => {
    if (!img || typeof img !== "object") {
      return img;
    }
    const row = img as Record<string, unknown>;
    const b64 = row.base64;
    return {
      imageId: row.imageId,
      mimeType: row.mimeType,
      base64_length: typeof b64 === "string" ? b64.length : 0,
    };
  });
  return clone;
}
