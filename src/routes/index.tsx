import { createFileRoute } from "@tanstack/react-router";
import { Lobby } from "@/components/casino/Lobby";
import { GameGate } from "@/components/slot/GameGate";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <GameGate>{({ admin }) => <Lobby admin={admin} />}</GameGate>;
}
