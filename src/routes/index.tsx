import { createFileRoute } from "@tanstack/react-router";
import { EditorApp } from "@/components/editor/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <EditorApp />;
}
