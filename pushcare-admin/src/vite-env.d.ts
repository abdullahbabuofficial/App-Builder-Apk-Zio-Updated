/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUSHCARE_API_URL?: string;
  /** auto | rest | supabase | mock — rest = always use API URL even with Supabase session */
  readonly VITE_PUSHCARE_DATA_SOURCE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
