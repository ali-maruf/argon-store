import { productFeed } from "@/lib/feeds";

export const revalidate = 3600;
export async function GET() {
  return new Response(await productFeed("google"), { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
