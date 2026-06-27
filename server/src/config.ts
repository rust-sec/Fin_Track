import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-me",
  cookieSecret: process.env.COOKIE_SECRET ?? "dev-cookie-secret-change-me",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",
};

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required");
}
