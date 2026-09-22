import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import path from 'path';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const DELIVERY_DOCS_BUCKET = 'delivery-docs';

// Uploads a delivery-workflow document to Supabase Storage and returns its
// public URL. Storage is used instead of local disk because Render's web
// service filesystem is ephemeral and wipes uploaded files on every deploy.
export async function uploadDeliveryDoc(buffer: Buffer, originalName: string, mimetype: string): Promise<string> {
  const ext = path.extname(originalName);
  const key = `${randomUUID()}${ext}`;

  const { error } = await supabase.storage
    .from(DELIVERY_DOCS_BUCKET)
    .upload(key, buffer, { contentType: mimetype, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(DELIVERY_DOCS_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}
