import { NextRequest, NextResponse } from 'next/server';
import { parseListing } from '@/lib/scraper';
import { fetchJourney } from '@/lib/bvg';
import { calculateScore } from '@/lib/scoring';
import * as db from '@/lib/db';
import { DestinationJourney, RouteSettings } from '@/lib/types';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.5',
};

async function sendMessage(chatId: number, text: string) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/\S+wg-gesucht\.de\S*/i);
  return match ? match[0].replace(/[)>\].,;!?]+$/, '') : null;
}

function formatJourneyReply(
  title: string,
  address: string,
  warmRent: number | null,
  size: number | null,
  url: string,
  journeys: DestinationJourney[],
): string {
  const lines: string[] = [];
  lines.push(`<b>${title}</b>`);
  lines.push(`📍 ${address}`);

  const meta: string[] = [];
  if (warmRent !== null) meta.push(`💶 ${warmRent} €`);
  if (size !== null) meta.push(`📐 ${size} m²`);
  if (meta.length) lines.push(meta.join('  ·  '));

  lines.push('');
  lines.push('<b>Fahrtzeiten:</b>');

  for (const dj of journeys) {
    if (dj.journey) {
      lines.push(`🚇 <b>${dj.destinationName}</b>: ${dj.journey.durationMinutes} min (${dj.journey.transfers} Umstiege)`);
    } else {
      lines.push(`🚇 <b>${dj.destinationName}</b>: Fehler`);
    }
  }

  lines.push('');
  lines.push(`<a href="${url}">Zum Inserat ↗</a>`);
  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  // Verify webhook secret if configured
  if (WEBHOOK_SECRET) {
    const secret = req.headers.get('x-telegram-bot-api-secret-token');
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
  }

  let body: { message?: { chat: { id: number }; text?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = body.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const text = message.text;

  const url = extractUrl(text);
  if (!url) {
    await sendMessage(chatId, '⚠️ Kein WG-Gesucht-Link gefunden. Schick mir eine Nachricht mit einem wg-gesucht.de Link.');
    return NextResponse.json({ ok: true });
  }

  await sendMessage(chatId, '🔍 Inserat wird verarbeitet…');

  try {
    // Scrape listing
    let listing = null;
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (res.ok) {
        const html = await res.text();
        const isBlocked =
          html.includes('cf-browser-verification') ||
          html.includes('<div class="g-recaptcha"') ||
          html.length < 20_000;
        if (!isBlocked) {
          listing = parseListing(html, url);
        }
      }
    } catch {
      // scraping failed
    }

    if (!listing) {
      await sendMessage(chatId, '⚠️ Inserat konnte nicht geladen werden (CAPTCHA oder Fehler). URL wurde trotzdem gespeichert.');
      // Save a minimal placeholder
      const id = crypto.randomUUID();
      await db.upsertListing(
        id,
        { url, title: 'Unbekannt', address: 'Adresse nicht gefunden', warmRent: null, coldRent: null, size: null, lat: null, lng: null, scrapedAt: new Date().toISOString() },
        [],
        false,
      );
      return NextResponse.json({ ok: true });
    }

    // Calculate journeys
    const destinations = await db.fetchDestinations();
    const settings: RouteSettings = { timeMode: 'arrival', time: '08:00' };
    let destinationJourneys: DestinationJourney[] = [];

    if (listing.lat && listing.lng && destinations.length > 0) {
      destinationJourneys = await Promise.all(
        destinations.map(async (dest): Promise<DestinationJourney> => {
          try {
            const journey = await fetchJourney(
              listing!.lat!,
              listing!.lng!,
              listing!.address,
              dest.lat,
              dest.lng,
              dest.address,
              settings,
            );
            return {
              destinationId: dest.id,
              destinationName: dest.name,
              journey,
              score: journey ? calculateScore(listing!, journey) : null,
              error: null,
            };
          } catch {
            return { destinationId: dest.id, destinationName: dest.name, journey: null, score: null, error: 'Fehler' };
          }
        }),
      );
    }

    // Save to DB
    const id = crypto.randomUUID();
    await db.upsertListing(id, listing, destinationJourneys, false);

    // Reply
    if (destinations.length === 0) {
      await sendMessage(chatId, `✅ Gespeichert!\n\n<b>${listing.title}</b>\n📍 ${listing.address}\n\n⚠️ Keine Ziele konfiguriert – Fahrtzeiten konnten nicht berechnet werden.`);
    } else {
      const reply = formatJourneyReply(
        listing.title,
        listing.address,
        listing.warmRent,
        listing.size,
        url,
        destinationJourneys,
      );
      await sendMessage(chatId, `✅ Gespeichert!\n\n${reply}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    await sendMessage(chatId, `❌ Fehler: ${msg}`);
  }

  return NextResponse.json({ ok: true });
}
