import { UserRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  permissions: string[];
  accessRole?: {
    id: string;
    key: string;
    name: string;
  } | null;
};

type RequestHeaders = {
  authorization?: string;
};

/** Populated by the cookie-parser middleware registered in main.ts. */
type RequestCookies = Record<string, string | undefined>;

export type AuthenticatedRequest = {
  headers: RequestHeaders;
  cookies?: RequestCookies;
  user: AuthUser;
};

export type OptionalAuthenticatedRequest = {
  headers: RequestHeaders;
  cookies?: RequestCookies;
  user?: AuthUser;
};
