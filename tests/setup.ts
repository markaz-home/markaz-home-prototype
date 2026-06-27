import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load the shared root .env so integration tests reach the local Supabase DB.
config({ path: resolve(__dirname, '../.env') });
