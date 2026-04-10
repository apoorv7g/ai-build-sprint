import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Return a placeholder during build - will fail at runtime if not set
    return "postgresql://placeholder:placeholder@placeholder/placeholder";
  }
  return url;
};

const sql = neon(getDatabaseUrl());
export const db = drizzle(sql, { schema });
