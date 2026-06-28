import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/bottom-nav";
import { PostGameReviewGate } from "@/components/post-game-review-modal";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" search={{ redirect: `${location.pathname}${location.searchStr ?? ""}` }} replace />;
  return (
    <div className="min-h-screen bg-paper pb-20">
      <Outlet />
      <BottomNav />
      <PostGameReviewGate />
    </div>
  );
}
