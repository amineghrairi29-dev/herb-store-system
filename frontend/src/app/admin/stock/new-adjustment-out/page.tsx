import type { Metadata } from "next";
import MovementPage from "../movement-page";
import { movementConfigs } from "../movement-config";

export const metadata: Metadata = { title: movementConfigs.ADJUSTMENT_OUT.title };

export default function Page() {
  return <MovementPage type="ADJUSTMENT_OUT" />;
}
