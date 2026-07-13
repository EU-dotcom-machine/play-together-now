import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { PostGameReviewGate } from "@/components/post-game-review-modal";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  usePushNotifications();

  const { data: onboardingFlag, isLoading: flagLoading } = useQuery({
    queryKey: ["onboarding-completed", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user!.id)
        .maybeSingle();
      return (data as any)?.onboarding_completed ?? false;
    },
  });

  if (loading) return null;
  if (!user)
    return (
      <Navigate
        to="/auth"
        search={{ redirect: `${location.pathname}${location.searchStr ?? ""}` }}
        replace
      />
    );

  const isOnboarding = location.pathname === "/onboarding";
  if (flagLoading) return null;
  if (!onboardingFlag && !isOnboarding) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen bg-paper pb-20">
      <Outlet />
      {!isOnboarding && <BottomNav />}
      {!isOnboarding && <PostGameReviewGate />}
    </div>
  );
}
