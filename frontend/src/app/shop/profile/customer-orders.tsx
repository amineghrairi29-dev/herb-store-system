"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiBase } from "@/lib/api-base";
import { displayAmount } from "@/lib/purchase-decimal";
import { customerOrderLabel, orderGrandTotal, type DeliveryStatus, type OrderStatus } from "@/types/online-order";
import styles from "./profile.module.css";

interface CustomerOrder { reference: string; status: OrderStatus; deliveryStatus: DeliveryStatus | null; totalAmount: string; deliveryFee: string | null; createdAt: string; itemCount: number }

/** The signed-in customer's orders with their current status. */
export default function CustomerOrders() {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/public/customer/orders`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); setOrders(await response.json() as CustomerOrder[]); })
      .catch(() => { if (!controller.signal.aborted) setError("Impossible de charger vos commandes."); });
    return () => controller.abort();
  }, []);
  return <section className={styles.card} aria-labelledby="orders-title">
    <h2 id="orders-title">Mes commandes</h2>
    {error ? <p role="alert" className={styles.error}>{error}</p>
      : !orders ? <p role="status">Chargement…</p>
      : !orders.length ? <p>Aucune commande pour le moment. <Link href="/shop#products" className="underline">Découvrir nos produits</Link></p>
      : <ul className={styles.orders}>{orders.map((order) => <li key={order.reference} className={styles.order}>
          <div><strong><bdi>{order.reference}</bdi></strong><span>{new Date(order.createdAt).toLocaleDateString("fr-FR")} · {order.itemCount} article{order.itemCount > 1 ? "s" : ""}</span></div>
          <div className={styles.orderMeta}><span className={styles.orderStatus} data-status={order.deliveryStatus ?? order.status}>{customerOrderLabel(order.status, order.deliveryStatus)}</span><span>{displayAmount(orderGrandTotal(order.totalAmount, order.deliveryFee))} TND</span></div>
        </li>)}</ul>}
  </section>;
}
