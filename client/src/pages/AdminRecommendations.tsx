/**
 * Admin recommendations area — thin page wrappers.
 *
 * All real logic lives in client/src/components/admin/recommendations/.
 * This file exists only to expose two route components consumed by App.tsx.
 */

export { RecommendationsOverview as AdminRecommendationsOverview } from "@/components/admin/recommendations/RecommendationsOverview";
export { RecommendationsWorkerView as AdminRecommendationsWorker } from "@/components/admin/recommendations/RecommendationsWorkerView";
