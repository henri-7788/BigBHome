import { NextRequest, NextResponse } from 'next/server';
import { parseListing } from '@/lib/scraper';
import { ScrapeResponse } from '@/lib/types';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.5',
};

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json<ScrapeResponse>({ success: false, error: 'URL fehlt' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json<ScrapeResponse>({ success: false, error: 'Ungültige URL' }, { status: 400 });
    }

    if (!parsedUrl.hostname.includes('wg-gesucht.de')) {
      return NextResponse.json<ScrapeResponse>(
        { success: false, error: 'Nur WG-Gesucht Links werden unterstützt' },
        { status: 400 },
      );
    }

    let html: string;
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) {
        return NextResponse.json<ScrapeResponse>({
          success: false,
          fallback: true,
          error: `HTTP ${res.status}`,
        });
      }
      html = await res.text();
    } catch (err) {
      return NextResponse.json<ScrapeResponse>({
        success: false,
        fallback: true,
        error: err instanceof Error ? err.message : 'Netzwerkfehler',
      });
    }

    // Detect actual block/challenge pages.
    // Do NOT check for 'captcha' broadly — WG-Gesucht embeds "recaptcha.net"
    // in its CSP headers on every normal page, which causes false positives.
    const isBlockedPage =
      html.includes('cf-browser-verification') ||
      html.includes('cf_challenge_form') ||
      html.includes('<div class="g-recaptcha"') ||
      html.length < 20_000; // real listings are 100 KB+; challenge pages are tiny

    if (isBlockedPage) {
      return NextResponse.json<ScrapeResponse>({
        success: false,
        fallback: true,
        error: 'Seite blockiert – bitte Adresse manuell eingeben',
      });
    }

    const listing = parseListing(html, url);

    return NextResponse.json<ScrapeResponse>({
      success: true,
      data: listing,
      fallback: listing.lat === null,
    });
  } catch (err) {
    return NextResponse.json<ScrapeResponse>(
      {
        success: false,
        fallback: true,
        error: err instanceof Error ? err.message : 'Unbekannter Fehler',
      },
      { status: 500 },
    );
  }
}
