import OrderList from "./order-list";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams, query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) { if (Array.isArray(value)) value.forEach((item) => query.append(key, item)); else if (value !== undefined) query.set(key, value); }
  return <OrderList key={query.toString()} query={query.toString()} />;
}
