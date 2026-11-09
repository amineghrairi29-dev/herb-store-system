import CustomerAuth from "./customer-auth";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <CustomerAuth
      returnTo={
        typeof params.returnTo === "string" ? params.returnTo : "/shop/checkout"
      }
      googleError={params.error === "google"}
    />
  );
}
