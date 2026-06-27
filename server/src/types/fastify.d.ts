import "@fastify/jwt";
import type { AuthUser } from "../auth.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}
