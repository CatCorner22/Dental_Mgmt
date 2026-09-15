import { authStoreKind } from "@/lib/auth/resolveStore";

export async function GET() {
  return Response.json({
    ok: true,
    increment: "0.3",
    bytestarDefault: "off",
    phiPatientRows: false,
    authStore: authStoreKind(),
  });
}
