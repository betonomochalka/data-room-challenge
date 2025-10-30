import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with service role key for server-side operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Create Supabase client with anon key for client-side operations
export const supabaseAnon = createClient(
  supabaseUrl,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  }
);

export const uploadFile = async (
  file: Buffer,
  fileName: string,
  folder: string = 'uploads',
  mimeType?: string
): Promise<string> => {
  const fileExt = fileName.split('.').pop();
  const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

  // Determine content type based on mimeType or file extension
  let contentType = mimeType || 'application/octet-stream';
  if (!mimeType) {
    const ext = fileExt?.toLowerCase();
    const mimeMap: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'pdf': 'application/pdf',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    contentType = mimeMap[ext || ''] || 'application/octet-stream';
  }

  const { data, error } = await supabase.storage
    .from('data-room-files')
    .upload(filePath, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return filePath;
};

export const getSignedUrl = async (filePath: string): Promise<string> => {
    let path = filePath;
    const bucketName = 'data-room-files';
    
    // Check if the filePath is a full URL and extract the path if it is
    if (path.includes(bucketName)) {
        path = path.substring(path.indexOf(bucketName) + bucketName.length + 1);
    }
    
    const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(path, 60); // 60 seconds expiry

    if (error) {
        throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
}

export const deleteFile = async (filePath: string): Promise<void> => {
  const { error } = await supabase.storage
    .from('data-room-files')
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

export const getFileUrl = (filePath: string): string => {
  const { data: { publicUrl } } = supabase.storage
    .from('data-room-files')
    .getPublicUrl(filePath);
  
  return publicUrl;
};
