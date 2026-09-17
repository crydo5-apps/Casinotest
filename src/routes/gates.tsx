import { createFileRoute } from "@tanstack/react-router";
import { GatesApp } from "@/components/gates/GatesApp";

export const Route = createFileRoute("/gates")({ component: GatesApp });
