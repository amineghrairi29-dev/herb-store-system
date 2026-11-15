"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiBase } from "@/lib/api-base";
import { displayAmount } from "@/lib/purchase-decimal";
import { customerOrderLabel, customerSteps, orderGrandTotal, type DeliveryStatus, type OrderStatus } from "@/types/online-order";
import styles from "./profile.module.css";

interface CustomerOrder { reference: string; status: OrderStatus; deliveryStatus: DeliveryStatus | null; totalAmount: string; deliveryFee: string | null; createdAt: string; itemCount: number }

/** The signed-in customer's orders: status, a small progress bar and a link to the full tracking. */
export default function CustomerOrders() {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/public/customer/orders`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); setOrders(await response.json() as CustomerOrder[]); })
      .catch(() => { if (!controller.signal.aborted) setError("Impossible de charger vos commandes."); });
    return () => controller.abort();
  }, []);
  const format = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return <section className={styles.card} aria-labelledby="orders-title" style={{ "--i": 0 } as React.CSSProperties}>
    <div className={styles.cardHead}><h2 id="orders-title">Mes commandes</h2>{orders && orders.length > 0 && <span className={styles.countPill}>{orders.length}</span>}</div>
    {error ? <p role="alert" className={styles.error}>{error}</p>
      : !orders ? <div className={styles.orders} role="status" aria-label="Chargement des commandes"><div className={styles.skeletonLine} /><div className={styles.skeletonLine} /></div>
      : !orders.length ? <div className={styles.noOrders}><p lang="ar" dir="rtl">مازلت ما عدّيت حتى كوموند</p><p>Vos commandes apparaîtront ici, avec leur suivi.</p><Link href="/shop#products" className={styles.save}>Découvrir les produits <span aria-hidden="true">→</span></Link></div>
      : <ul className={styles.orders}>{orders.map((order, index) => {
          const label = customerOrderLabel(order.status, order.deliveryStatus);
          const step = customerSteps.indexOf(label as (typeof customerSteps)[number]);
          const tone = step < 0 ? "stop" : step === customerSteps.length - 1 ? "done" : order.status === "PENDING" ? "wait" : "live";
          return <li key={order.reference} className={styles.order} style={{ "--i": index } as React.CSSProperties}>
            <div className={styles.orderMain}>
              <strong><bdi>{order.reference}</bdi></strong>
              <span>{format.format(new Date(order.createdAt))} · {order.itemCount} article{order.itemCount > 1 ? "s" : ""}</span>
            </div>
            <span className={styles.orderStatus} data-tone={tone}>{label}</span>
            <span className={styles.orderTotal}>{displayAmount(orderGrandTotal(order.totalAmount, order.deliveryFee))} <small>TND</small></span>
            {step >= 0 && <span className={styles.orderBar} aria-hidden="true"><i style={{ transform: `scaleX(${(step + 1) / customerSteps.length})` }} /></span>}
            <Link href={`/shop/suivi?ref=${encodeURIComponent(order.reference)}`} className={styles.orderLink}>Suivre <span aria-hidden="true">→</span></Link>
          </li>;
        })}</ul>}
  </section>;
}
