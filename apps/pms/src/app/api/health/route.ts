export async function GET() {
  return Response.json({
    ok: true,
    increment: "0.1",
    bytestarDefault: "off",
    phiPatientRows: false,
  });
}
