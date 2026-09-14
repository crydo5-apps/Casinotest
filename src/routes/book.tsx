import { createFileRoute } from "@tanstack/react-router";
import { GameGate } from "@/components/slot/GameGate";
import { SlotApp } from "@/components/slot/SlotApp";

export const Route = createFileRoute("/book")({ component: Book });

function Book() {
  return <GameGate>{({ admin }) => <SlotApp edition="classic" admin={admin} />}</GameGate>;
}
