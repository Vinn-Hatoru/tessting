import fs from "node:fs";

try {
  // Ensure target folder exists
  fs.mkdirSync(".next/standalone/.next", { recursive: true });

  // Copy static assets
  if (fs.existsSync(".next/static")) {
    fs.cpSync(".next/static", ".next/standalone/.next/static", {
      recursive: true,
      force: true,
    });
    console.log("✓ Copied .next/static to .next/standalone/.next/static");
  }

  // Copy public assets
  if (fs.existsSync("public")) {
    fs.cpSync("public", ".next/standalone/public", {
      recursive: true,
      force: true,
    });
    console.log("✓ Copied public to .next/standalone/public");
  }
} catch (err) {
  console.error("Failed to copy standalone assets:", err);
  process.exit(1);
}
