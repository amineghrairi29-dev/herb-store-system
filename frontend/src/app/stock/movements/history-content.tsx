"use client";
import { loadHistory } from "@/lib/stock-read";
import { useStockLoad } from "../use-stock-load";
import { LoadFeedback, controlClass } from "../stock-ui";
import MovementHistory from "../movement-history";
export default function HistoryContent() {
  const { state, reload } = useStockLoad(loadHistory);
  return <><LoadFeedback state={state} reload={reload} />{state.status === "success" && <>
    <button type="button" onClick={reload} className={`${controlClass} mb-4 font-semibold`}>Actualiser</button>
    <MovementHistory {...state.data} />
  </>}</>;
}
