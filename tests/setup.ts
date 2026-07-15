import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load env for integration tests, mirroring Next.js precedence:
//   already-set process.env  >  .env.local  >  .env
// `.env.local` (gitignored) targets the LOCAL Supabase stack, so integration —
// especially the destructive Storage tests — never reaches the hosted deploy.
// dotenv does not override an already-set var, so loading `.env.local` first gives
// it precedence over `.env`, and real exported env (CI) still wins over both.
const root = resolve(__dirname, '..');
config({ path: resolve(root, '.env.local') });
config({ path: resolve(root, '.env') });
