import { UserRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

type RequestHeaders = {
  authorization?: string;
};

export type AuthenticatedRequest = {
  headers: RequestHeaders;
  user: AuthUser;
};

export type OptionalAuthenticatedRequest = {
  headers: RequestHeaders;
  user?: AuthUser;
};
