import { authStoreKind } from "@/lib/auth/resolveStore";

export async function GET() {
  return Response.json({
    ok: true,
    increment: "0.2",
    bytestarDefault: "off",
    phiPatientRows: false,
    authStore: authStoreKind(),
  });
}
