"use client";
import { useEffect, useState } from "react";
import { stockError } from "@/lib/stock-api";

export function useStockLoad<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "success"; data: T }>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
    void load(signal).then((data) => {
      if (!controller.signal.aborted) setState({ status: "success", data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ status: "error", message: stockError(error) });
    });
    return () => controller.abort();
  }, [load, attempt]);
  return { state, reload: () => { setState({ status: "loading" }); setAttempt((value) => value + 1); } };
}
