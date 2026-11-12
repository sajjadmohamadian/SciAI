import dotenv from "dotenv";

// Load server-only configuration before modules read process.env. Explicit launch/deployment
// variables win; tests must never inherit developer credentials or production database paths.
if (process.env.NODE_ENV !== "test" && process.env.npm_lifecycle_event !== "test" &&
    !process.argv.includes("--test") && !process.execArgv.includes("--test")) {
  dotenv.config({ quiet: true, override: false });
}
