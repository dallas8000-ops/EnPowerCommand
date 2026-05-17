import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    tenantId?: string;
    userId?: string;
    userRole?: string;
    userEmail?: string;
    tenantPlan?: string;
    trialEnds?: number;
  }
}
