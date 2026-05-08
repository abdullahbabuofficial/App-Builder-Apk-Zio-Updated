#!/usr/bin/env node
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function validateProductionEnv() {
  const envProdPath = join(__dirname, "../.env.production");
  let envContent = "";
  
  try {
    envContent = readFileSync(envProdPath, "utf-8");
  } catch {
    console.error("❌ .env.production file not found!");
    process.exit(1);
  }
  
  const lines = envContent.split("\n");
  const vars = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      vars[key.trim()] = valueParts.join("=").trim();
    }
  }
  
  // Check VITE_APKZIO_DATA_SOURCE
  if (vars.VITE_APKZIO_DATA_SOURCE === "mock") {
    console.error("❌ FATAL: VITE_APKZIO_DATA_SOURCE=mock is not allowed in production!");
    console.error("   Set it to 'rest' or 'supabase' in .env.production");
    process.exit(1);
  }
  
  if (!vars.VITE_APKZIO_DATA_SOURCE) {
    console.warn("⚠️  WARNING: VITE_APKZIO_DATA_SOURCE not set, will default to 'mock'");
    console.warn("   This will cause a runtime error in production builds.");
  }
  
  // Check API URL for rest mode
  if (vars.VITE_APKZIO_DATA_SOURCE === "rest" && !vars.VITE_APKZIO_API_URL) {
    console.error("❌ FATAL: VITE_APKZIO_API_URL is required when using REST data source!");
    process.exit(1);
  }
  
  // Check Supabase config for supabase mode
  if (vars.VITE_APKZIO_DATA_SOURCE === "supabase") {
    if (!vars.VITE_SUPABASE_URL) {
      console.error("❌ FATAL: VITE_SUPABASE_URL is required when using Supabase data source!");
      process.exit(1);
    }
    if (!vars.VITE_SUPABASE_ANON_KEY) {
      console.error("❌ FATAL: VITE_SUPABASE_ANON_KEY is required when using Supabase data source!");
      process.exit(1);
    }
  }
  
  console.log("✅ Production environment validation passed");
  console.log(`   Data source: ${vars.VITE_APKZIO_DATA_SOURCE || "mock (will error at runtime)"}`);
}

validateProductionEnv();
