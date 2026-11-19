import Link from "next/link";

/** Addresses outside the shop (the shop has its own page, in its own layout). */
export default function RootNotFound() {
  return (
    <main
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        padding: "48px 20px",
        background: "#fbfaf5",
        color: "#1f3a24",
        textAlign: "center",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 480 }}>
        <p
          lang="ar"
          dir="rtl"
          style={{ margin: 0, fontFamily: "var(--font-arabic), serif", fontSize: 44, color: "#2e5e2b" }}
        >
          ما لقيناهاش
        </p>
        <h1 style={{ margin: "8px 0 10px", fontSize: 28, fontWeight: 500 }}>Page introuvable</h1>
        <p style={{ margin: 0, color: "#5d6b57", lineHeight: 1.6 }}>Le lien est peut-être ancien ou mal recopié.</p>
        <Link
          href="/shop"
          style={{
            display: "inline-flex",
            marginTop: 22,
            padding: "13px 24px",
            borderRadius: 999,
            background: "#3e7b3a",
            color: "#fff",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Aller à la boutique دار سلومة
        </Link>
      </div>
    </main>
  );
}
