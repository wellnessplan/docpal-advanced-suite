// Supabase returns at most 1000 rows per request by default.
// `fetchAllPaged` transparently pages a builder until the table is exhausted,
// so aggregations (revenue, reports, KPIs) stay accurate as clinics grow.
//
// Usage:
//   const rows = await fetchAllPaged((from, to) =>
//     supabase.from("invoices").select("amount, status").eq("clinic_id", id).range(from, to)
//   );
//
// Pass a `pageSize` if you know rows are wide (X-rays, files) to keep memory low.
// `maxRows` is a safety cap (default 50k) so a runaway query can't OOM the tab.

const DEFAULT_PAGE = 1000;
const DEFAULT_MAX = 50_000;

type PageFetcher<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>;

export async function fetchAllPaged<T = any>(
  build: PageFetcher<T>,
  opts: { pageSize?: number; maxRows?: number } = {}
): Promise<T[]> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE;
  const maxRows = opts.maxRows ?? DEFAULT_MAX;
  const out: T[] = [];
  let from = 0;

  while (out.length < maxRows) {
    const to = from + pageSize - 1;
    const { data, error } = await build(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

// Convenience: get an exact row count without pulling rows.
export async function fetchExactCount(
  build: () => PromiseLike<{ count: number | null; error: any }>
): Promise<number> {
  const { count, error } = await build();
  if (error) throw error;
  return count ?? 0;
}
