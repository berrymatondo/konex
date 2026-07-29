import type { Metadata } from "next";
import { AccueilClient } from "./accueil-client";

export const metadata: Metadata = {
  title: "KONEX - Reserve Management & Strategic Allocation System",
  description:
    "Plateforme de gestion stratégique du portefeuille, analyse d'impact et négociation d'or pour les banques centrales.",
};

export default function AccueilPage() {
  return <AccueilClient />;
}
