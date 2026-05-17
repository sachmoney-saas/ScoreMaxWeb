import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeWeekdayPattern } from "@/lib/protocol-day";
import {
  DEFAULT_SKIN_PRESET_ID,
  STARTER_PRESET_IDS,
  type ActivePreset,
  type StarterPresetId,
  type AlwaysOnItem,
  type AvoidItem,
  type PresetStep,
  type ProtocolPreset,
  type RoutineSlot,
  type UserRoutineRow,
} from "@shared/protocol-presets";

const USER_ROUTINE_QUERY_KEY = "user-routine";

type RawPreset = ProtocolPreset;
type RawStep = Omit<PresetStep, "slot" | "weekday_pattern"> & {
  slot: string;
  weekday_pattern: unknown;
};
type RawAlwaysOn = AlwaysOnItem;
type RawAvoid = AvoidItem;

type RawUserRoutineRow = UserRoutineRow & {
  preset: RawPreset & {
    steps?: RawStep[];
    always_on?: RawAlwaysOn[];
    avoid?: RawAvoid[];
  };
};

function normaliseStep(row: RawStep): PresetStep {
  const slot = row.slot;
  if (slot !== "morning" && slot !== "midday" && slot !== "evening") {
    throw new Error(`Invalid routine slot: ${slot}`);
  }
  return {
    ...row,
    slot: slot as RoutineSlot,
    weekday_pattern: sanitizeWeekdayPattern(row.weekday_pattern),
  };
}

function mapRow(row: RawUserRoutineRow): ActivePreset {
  const { preset, ...routine } = row;
  const { steps = [], always_on = [], avoid = [], ...presetFields } = preset;

  return {
    routine: {
      id: routine.id,
      user_id: routine.user_id,
      preset_id: routine.preset_id,
      started_at: routine.started_at,
      removed_at: routine.removed_at,
    },
    preset: presetFields,
    steps: steps.map(normaliseStep),
    alwaysOn: always_on,
    avoid: avoid,
  };
}

async function fetchUserRoutine(userId: string): Promise<ActivePreset[]> {
  const { data, error } = await supabase
    .from("scoremax_user_routine")
    .select(
      `
        id,
        user_id,
        preset_id,
        started_at,
        removed_at,
        preset:scoremax_protocol_presets!inner(
          id,
          slug,
          target_worker,
          title_en,
          title_fr,
          summary_en,
          summary_fr,
          priority,
          enabled,
          steps:scoremax_protocol_preset_steps(
            id,
            preset_id,
            slot,
            weekday_pattern,
            position,
            title_en,
            title_fr,
            detail_en,
            detail_fr
          ),
          always_on:scoremax_protocol_preset_always_on(
            id,
            preset_id,
            position,
            title_en,
            title_fr,
            detail_en,
            detail_fr
          ),
          avoid:scoremax_protocol_preset_avoid(
            id,
            preset_id,
            position,
            title_en,
            title_fr,
            detail_en,
            detail_fr,
            severity
          )
        )
      `,
    )
    .eq("user_id", userId)
    .is("removed_at", null)
    .order("started_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as RawUserRoutineRow[];
  return rows
    .map((row) => {
      const preset = Array.isArray(row.preset) ? row.preset[0] : row.preset;
      return mapRow({ ...row, preset });
    })
    .filter((p) => p.preset.id)
    .sort((a, b) => a.preset.priority - b.preset.priority);
}

export function useUserRoutine() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: [USER_ROUTINE_QUERY_KEY, userId],
    queryFn: () => fetchUserRoutine(userId!),
    enabled: !!userId,
    staleTime: 1000 * 30,
  });
}

async function assignPresetForUser(
  userId: string,
  presetId: string,
): Promise<{ id: string } | null> {
  const { data: existing, error: selectError } = await supabase
    .from("scoremax_user_routine")
    .select("id")
    .eq("user_id", userId)
    .eq("preset_id", presetId)
    .is("removed_at", null)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("scoremax_user_routine")
    .insert({
      user_id: userId,
      preset_id: presetId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("scoremax_user_routine")
        .select("id")
        .eq("user_id", userId)
        .eq("preset_id", presetId)
        .is("removed_at", null)
        .maybeSingle();
      return retry;
    }
    throw error;
  }

  return data;
}

/** @deprecated Prefer `useAssignStarterPresets` */
export function useAssignDefaultPreset() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  return useMutation({
    mutationFn: async (presetId: string = DEFAULT_SKIN_PRESET_ID) => {
      if (!userId) throw new Error("Not authenticated");
      return assignPresetForUser(userId, presetId);
    },
    onSuccess: () => {
      if (userId) {
        void queryClient.invalidateQueries({
          queryKey: [USER_ROUTINE_QUERY_KEY, userId],
        });
      }
    },
  });
}

export function useAssignStarterPresets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  return useMutation({
    mutationFn: async (
      presetIds: readonly StarterPresetId[] = STARTER_PRESET_IDS,
    ) => {
      if (!userId) throw new Error("Not authenticated");

      const results: Array<{ id: string } | null> = [];
      for (const presetId of presetIds) {
        results.push(await assignPresetForUser(userId, presetId));
      }
      return results;
    },
    onSuccess: () => {
      if (userId) {
        void queryClient.invalidateQueries({
          queryKey: [USER_ROUTINE_QUERY_KEY, userId],
        });
      }
    },
  });
}
