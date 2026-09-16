import { createFileRoute } from "@tanstack/react-router";
import { GameGate } from "@/components/slot/GameGate";
import { CowboyApp } from "@/components/cowboy/CowboyApp";

export const Route = createFileRoute("/cowboy")({ component: Cowboy });

function Cowboy() {
  return <GameGate>{({ admin }) => <CowboyApp admin={admin} />}</GameGate>;
}
