import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL and Anon Key are missing in environment variables (.env).');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Uploads a file directly to Supabase storage bucket 'study-buddy-docs'
 * Returns the public URL of the uploaded document.
 */
export async function uploadFileToSupabaseStorage(file: File): Promise<{ publicUrl: string; path: string }> {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `uploads/${Date.now()}_${sanitizedName}`;

  const { error: uploadError } = await supabase.storage
    .from('study-buddy-docs')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('study-buddy-docs').getPublicUrl(filePath);

  return {
    publicUrl: data.publicUrl,
    path: filePath
  };
}

