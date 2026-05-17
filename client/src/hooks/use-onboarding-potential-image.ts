import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type OnboardingPotentialImage = {
  id: string;
  status: "pending" | "completed" | "failed";
  signed_url: string | null;
  /** JPEG visage face (même asset qu’envoyé à OneShot pour le potentiel). */
  source_face_signed_url: string | null;
  /** `GUIDE_TRACE_FACE_FRONT_MASK_OVERLAY` si dispo, sinon `FACE_FRONT` — pour autres usages. */
  mask_overlay_signed_url: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

async function fetchPotentialImage(): Promise<OnboardingPotentialImage | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  const res = await apiRequest(
    "GET",
    "/v1/onboarding/potential-image",
    undefined,
    { Authorization: `Bearer ${token}` },
  );
  const json = (await res.json()) as {
    data?: { potential_image: OnboardingPotentialImage | null };
  };
  return json.data?.potential_image ?? null;
}

export function useOnboardingPotentialImage(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  return useQuery<OnboardingPotentialImage | null>({
    queryKey: ["onboarding-potential-image", user?.id],
    queryFn: fetchPotentialImage,
    enabled: !!user?.id && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const value = query.state.data;
      if (!value) return 2500;
      if (value.status === "pending") return 2500;
      return false;
    },
    staleTime: 0,
  });
}
