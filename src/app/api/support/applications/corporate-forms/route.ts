import { proxyUpstreamJSON, normalizePaging } from "@/src/lib/supportApiProxy";

export async function GET(req: Request) {
  const url = new URL(req.url);
  normalizePaging(url.searchParams);
  return proxyUpstreamJSON({
    path: "/support/applications/corporate-forms",
    method: "GET",
    query: url.searchParams,
  });
}

