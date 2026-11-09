import CustomerAuth from '../shop/auth/customer-auth';

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <CustomerAuth returnTo="/shop" googleError={params.error === 'google'} entry />;
}
