import { createFileRoute } from "@tanstack/react-router";
import { GameGate } from "@/components/slot/GameGate";
import { RouletteApp } from "@/components/roulette/RouletteApp";

export const Route = createFileRoute("/roulette")({ component: Roulette });

function Roulette() {
  return <GameGate>{({ admin }) => <RouletteApp admin={admin} />}</GameGate>;
}
