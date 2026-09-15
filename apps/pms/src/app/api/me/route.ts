import { withGuard } from "@/lib/auth/withGuard";

export const GET = withGuard(async () => {
  return Response.json({
    ok: true,
    increment: "0.1",
    note: "Identity is returned once authorization ports are connected to Postgres.",
  });
}, { minRank: "user" });
