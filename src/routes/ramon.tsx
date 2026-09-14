import { createFileRoute } from "@tanstack/react-router";
import { GameGate } from "@/components/slot/GameGate";
import { SlotApp } from "@/components/slot/SlotApp";

export const Route = createFileRoute("/ramon")({ component: Ramon });

function Ramon() {
  return <GameGate>{({ admin }) => <SlotApp edition="ramon" admin={admin} />}</GameGate>;
}
