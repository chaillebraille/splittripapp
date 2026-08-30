import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/groups/$groupId")({
  ssr: false,
  component: GroupLayout,
});

function GroupLayout() {
  return <Outlet />;
}
