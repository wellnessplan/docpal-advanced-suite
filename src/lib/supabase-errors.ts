import { toast } from "sonner";

const ERROR_MAP: Record<string, string> = {
  "new row violates row-level security policy": "You don't have permission for this action. Please check your login.",
  "duplicate key value violates unique constraint": "This record already exists. Please check for duplicates.",
  "violates foreign key constraint": "This record references data that doesn't exist or was removed.",
  "null value in column": "A required field is missing. Please fill in all required fields.",
  "value too long for type": "One of the values is too long. Please shorten your input.",
  "invalid input syntax": "Invalid data format. Please check your input.",
  "JWT expired": "Your session has expired. Please refresh the page.",
  "PGRST116": "Record not found. It may have been deleted.",
  "Failed to fetch": "Network error. Please check your internet connection and try again.",
  "23505": "This record already exists.",
  "23503": "Cannot complete — a related record is missing.",
  "42501": "You don't have permission for this action.",
};

export function handleSupabaseError(error: any, fallback = "Something went wrong. Please try again.") {
  const msg = error?.message || error?.error_description || String(error);
  
  for (const [key, friendly] of Object.entries(ERROR_MAP)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) {
      toast.error(friendly);
      return friendly;
    }
  }

  // Don't show raw DB errors to users
  if (msg.includes("PGRST") || msg.includes("pg_") || msg.includes("relation ")) {
    toast.error(fallback);
    return fallback;
  }

  toast.error(fallback);
  console.error("[Supabase Error]", msg);
  return fallback;
}
