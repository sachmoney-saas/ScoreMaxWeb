import * as React from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, UserRound } from "lucide-react";
import { useAdminAnalysisJobDetail } from "@/hooks/use-supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { buildAdminAnalysisJobAssetUrl } from "@/lib/admin-analysis";
import { AuthenticatedThumbnail } from "@/components/analysis/AuthenticatedThumbnail";
import { useAuth } from "@/hooks/use-auth";

function DataCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-white/10 bg-black/25 text-zinc-50">
      <CardContent className="space-y-3 p-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

function ImageDataThumb({
  image,
}: {
  image: { imageId: string; mimeType: string; base64: string };
}) {
  return (
    <div className="space-y-2 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-2">
      <p className="truncate text-[11px] font-mono uppercase tracking-wide text-zinc-500">
        {image.imageId} · {image.mimeType}
      </p>
      <img
        alt={image.imageId}
        className="aspect-square w-full rounded-xl object-cover"
        src={`data:${image.mimeType};base64,${image.base64}`}
      />
    </div>
  );
}

function JobAssetThumb({ jobId, assetTypeCode }: { jobId: string; assetTypeCode: string }) {
  return (
    <AuthenticatedThumbnail
      src={buildAdminAnalysisJobAssetUrl(jobId, assetTypeCode)}
      alt={assetTypeCode}
      className="aspect-square w-full rounded-xl object-cover"
      fallback={<div className="flex aspect-square items-center justify-center text-xs text-zinc-500">—</div>}
    />
  );
}

const DISPLAY_GUIDE_TRACE_CODES = new Set([
  "GUIDE_TRACE_FACE_FRONT_OVAL",
  "GUIDE_TRACE_FACE_FRONT_NOSE_MOUTH",
  "GUIDE_TRACE_FACE_FRONT_VERTICAL_THIRDS",
  "GUIDE_TRACE_FACE_FRONT_JAW_ANGLE",
  "GUIDE_TRACE_FACE_FRONT_SHAPE_CONTOUR",
  "GUIDE_TRACE_PROFILE_LEFT_JAW",
  "GUIDE_TRACE_PROFILE_RIGHT_JAW",
  "GUIDE_TRACE_PROFILE_LEFT_NOSE",
  "GUIDE_TRACE_PROFILE_RIGHT_NOSE",
  "GUIDE_TRACE_LOOK_UP_JAW_ARC",
  "GUIDE_TRACE_LOOK_DOWN_CROWN_MIRROR",
  "GUIDE_TRACE_SMILE_LIPS",
  "GUIDE_TRACE_EYE_CLOSEUP_CONTOURS",
]);

export default function AdminAnalysisJobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const { isAdmin } = useAuth();
  const { data, isLoading, isError } = useAdminAnalysisJobDetail(params.jobId, {
    enabled: isAdmin,
  });
  const [tab, setTab] = React.useState<"oneshot" | "display">("oneshot");

  if (!isAdmin) {
    return <div className="p-6 text-zinc-200">Accès refusé.</div>;
  }

  if (isLoading) {
    return <Skeleton className="h-[70vh] w-full" />;
  }

  if (isError || !data) {
    return (
      <div className="space-y-4 p-6 text-zinc-100">
        <Button variant="ghost" className="gap-2" onClick={() => setLocation("/admin/analysis-failures")}>
          <ArrowLeft className="h-4 w-4" /> Retour logs
        </Button>
        <Card className="border-white/10 bg-black/25">
          <CardContent className="p-6">Détail indisponible.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 text-zinc-50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Button variant="ghost" className="gap-2 px-0 text-zinc-300 hover:bg-transparent hover:text-white" onClick={() => setLocation("/admin/analysis-failures")}>
            <ArrowLeft className="h-4 w-4" /> Retour logs
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-white">Analyse {data.job.id.slice(0, 8)}…</h1>
            <p className="text-sm text-zinc-400">{data.user_email ?? data.job.user_id}</p>
          </div>
        </div>
        <Button variant="outline" className="border-white/15 bg-black/25" asChild>
          <Link href={`/app/analyses/${data.job.id}?asUser=${data.job.user_id}`}>
            <UserRound className="mr-2 h-4 w-4" /> Impersonifier
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={cn("border-white/20 text-zinc-200")}>{data.job.status}</Badge>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "oneshot" | "display") }>
        <TabsList className="bg-black/25">
          <TabsTrigger value="oneshot">Images analysis</TabsTrigger>
          <TabsTrigger value="display">Images dessinées</TabsTrigger>
        </TabsList>

        <TabsContent value="oneshot" className="mt-4 space-y-4">
          <DataCard title="8 images envoyées à oneshotapi">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.oneshot_images.map((image) => (
                <ImageDataThumb key={image.imageId} image={image} />
              ))}
            </div>
          </DataCard>
        </TabsContent>

        <TabsContent value="display" className="mt-4 space-y-4">
          <DataCard
            title={`Images dessinées / guide traces (${
              data.linked_assets.filter((asset) => DISPLAY_GUIDE_TRACE_CODES.has(asset.asset_type_code)).length
            })`}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.linked_assets
                .filter((asset) => DISPLAY_GUIDE_TRACE_CODES.has(asset.asset_type_code))
                .map((asset) => (
                  <div key={asset.scan_asset_id} className="space-y-2">
                    <p className="truncate text-[11px] uppercase tracking-wide text-zinc-500">{asset.asset_type_code}</p>
                    <JobAssetThumb jobId={data.job.id} assetTypeCode={asset.asset_type_code} />
                  </div>
                ))}
            </div>
            {data.linked_assets.filter((asset) => DISPLAY_GUIDE_TRACE_CODES.has(asset.asset_type_code)).length === 0 ? (
              <p className="text-sm text-zinc-500">Aucun guide trace lié.</p>
            ) : null}
          </DataCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
