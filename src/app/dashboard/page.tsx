import { redirect } from 'next/navigation';

/** Today and History merged into the Log tab; keep old links working. */
export default async function DashboardRedirect(props: PageProps<'/dashboard'>) {
  const searchParams = await props.searchParams;
  const raw = searchParams.date;
  const date = Array.isArray(raw) ? raw[0] : raw;
  redirect(date ? `/log?date=${date}` : '/log');
}
