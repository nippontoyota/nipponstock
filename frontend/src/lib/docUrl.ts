// Delivery workflow document fields hold either a local-disk relative path
// (legacy, e.g. "/uploads/delivery/xxx.pdf") or a full Supabase Storage URL
// (current). Only the former needs the backend origin prefixed.
export function docUrl(api: string, value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.startsWith('http') ? value : `${api}${value}`;
}
