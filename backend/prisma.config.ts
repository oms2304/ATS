import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // db push / migrate need the direct Supabase connection (port 5432)
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
