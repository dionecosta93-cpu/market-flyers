import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
  beforeLoad: () => {
    throw redirect({ to: "/flyers" });
  },
});

function Index() {
  return null;
}
