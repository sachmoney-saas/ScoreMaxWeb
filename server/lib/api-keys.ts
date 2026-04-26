import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  ApiKeyRecord,
  ApiKeyScope,
  CreateApiKeyRequest,
} from "@shared/oneshot";
import { getApiKeyConfig, getSupabaseAdminEnv } from "./env";
import { ApiError } from "./errors";

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: ApiKeyScope[];
  revoked_at: string | null;
  created_at: string;
  last_used_at: string | null;
};

const API_KEY_PREFIX = "sfak_key";
const HASH_KEY_LENGTH = 64;

function getSupabaseAdmin() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseAdminEnv();
  return createClient(supabaseUrl, serviceRoleKey);
}

function mapRecord(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
  };
}

function hashSecret(secret: string, salt: string, pepper: string): string {
  const hash = scryptSync(`${secret}:${pepper}`, salt, HASH_KEY_LENGTH);
  return hash.toString("hex");
}

function encodeHash(salt: string, hashHex: string): string {
  return `scrypt$${salt}$${hashHex}`;
}

function decodeHash(encoded: string): { salt: string; hashHex: string } {
  const [algo, salt, hashHex] = encoded.split("$");
  if (algo !== "scrypt" || !salt || !hashHex) {
    throw new ApiError({
      code: "API_KEY_INVALID",
      status: 401,
      message: "Malformed API key hash",
    });
  }

  return { salt, hashHex };
}

function makeKeyPrefix(id: string, randomSuffix: string): string {
  return `${API_KEY_PREFIX}_${id}_${randomSuffix}`;
}

function buildPlaintextKey(id: string, secret: string): string {
  return `${API_KEY_PREFIX}_${id}_${secret}`;
}

export function parseIncomingApiKey(input: string): { id: string; secret: string } {
  const trimmed = input.trim();
  const parts = trimmed.split("_");

  if (parts.length < 4 || parts[0] !== "sfak" || parts[1] !== "key") {
    throw new ApiError({
      code: "API_KEY_INVALID",
      status: 401,
      message: "Malformed API key",
    });
  }

  const id = parts[2];
  const secret = parts.slice(3).join("_");

  if (!id || !secret) {
    throw new ApiError({
      code: "API_KEY_INVALID",
      status: 401,
      message: "Malformed API key",
    });
  }

  return { id, secret };
}

export async function createApiKey(payload: CreateApiKeyRequest): Promise<{
  apiKey: string;
  record: ApiKeyRecord;
}> {
  const supabase = getSupabaseAdmin();
  const { pepper } = getApiKeyConfig();

  const id = randomBytes(8).toString("hex");
  const secret = randomBytes(20).toString("hex");
  const salt = randomBytes(16).toString("hex");
  const hashHex = hashSecret(secret, salt, pepper);
  const keyHash = encodeHash(salt, hashHex);
  const prefixSuffix = randomBytes(4).toString("hex");

  const keyPrefix = makeKeyPrefix(id, prefixSuffix);
  const plaintext = buildPlaintextKey(id, secret);

  const { data, error } = await supabase
    .from("oneshot_api_keys")
    .insert({
      id,
      name: payload.name.trim(),
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: payload.scopes,
    })
    .select("id,name,key_prefix,key_hash,scopes,revoked_at,created_at,last_used_at")
    .single<ApiKeyRow>();

  if (error || !data) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to create API key",
      details: error?.message,
    });
  }

  return {
    apiKey: plaintext,
    record: mapRecord(data),
  };
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("oneshot_api_keys")
    .select("id,name,key_prefix,key_hash,scopes,revoked_at,created_at,last_used_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to list API keys",
      details: error.message,
    });
  }

  return (data as ApiKeyRow[]).map(mapRecord);
}

export async function revokeApiKey(id: string): Promise<ApiKeyRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("oneshot_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,name,key_prefix,key_hash,scopes,revoked_at,created_at,last_used_at")
    .single<ApiKeyRow>();

  if (error || !data) {
    throw new ApiError({
      code: "API_KEY_INVALID",
      status: 401,
      message: "Unknown API key id",
      details: error?.message,
    });
  }

  return mapRecord(data);
}

export async function verifyApiKey(input: string): Promise<{
  id: string;
  scopes: ApiKeyScope[];
}> {
  const { id, secret } = parseIncomingApiKey(input);
  const { pepper } = getApiKeyConfig();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("oneshot_api_keys")
    .select("id,name,key_prefix,key_hash,scopes,revoked_at,created_at,last_used_at")
    .eq("id", id)
    .single<ApiKeyRow>();

  if (error || !data) {
    throw new ApiError({
      code: "API_KEY_INVALID",
      status: 401,
      message: "Unknown API key",
    });
  }

  if (data.revoked_at) {
    throw new ApiError({
      code: "API_KEY_REVOKED",
      status: 403,
      message: "API key has been revoked",
    });
  }

  const { salt, hashHex } = decodeHash(data.key_hash);
  const expected = Buffer.from(hashHex, "hex");
  const actual = Buffer.from(hashSecret(secret, salt, pepper), "hex");

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new ApiError({
      code: "API_KEY_INVALID",
      status: 401,
      message: "API key signature mismatch",
    });
  }

  await supabase
    .from("oneshot_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    id: data.id,
    scopes: data.scopes,
  };
}
