"use client";
import { useEffect, useState } from "react";
import { shopContent } from "@/lib/shop-content";

function minutes(text: string) {
  const [hours, mins] = text.split(":").map(Number);
  return hours * 60 + mins;
}

/** "Ouvert maintenant" / "Fermé · ouvre à 14h30", computed in Tunis time and refreshed every minute. */
export default function OpenStatus() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const read = () => {
      const parts = new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Africa/Tunis",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date());
      const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
      setNow(value("hour") * 60 + value("minute"));
    };
    read();
    const timer = window.setInterval(read, 60000);
    return () => window.clearInterval(timer);
  }, []);
  if (now === null) return null;
  const slots = shopContent.openingSlots.map(([from, to]) => [minutes(from), minutes(to)] as const);
  const open = slots.some(([from, to]) => now >= from && now < to);
  const next = slots.find(([from]) => from > now)?.[0] ?? slots[0][0];
  const label = (value: number) => `${Math.floor(value / 60)}h${String(value % 60).padStart(2, "0")}`;
  return (
    <span className="ip-open" data-open={open}>
      <span aria-hidden="true" />
      {open ? "Ouvert maintenant" : `Fermé · ouvre à ${label(next)}`}
    </span>
  );
}
