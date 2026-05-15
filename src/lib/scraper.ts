import * as cheerio from 'cheerio';
import { ScrapedListing } from './types';

function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[^\d]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

function extractCoordinates(html: string): { lat: number | null; lng: number | null } {
  // WG-Gesucht embeds coordinates as: markers: [{"lat":52.54,"lng":13.35,...}]
  const match = html.match(/"lat":([\d.]+),"lng":([\d.]+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return { lat: null, lng: null };
}

export function parseListing(html: string, url: string): ScrapedListing {
  const $ = cheerio.load(html);

  // ── Title ─────────────────────────────────────────────────────────────────
  const title = (
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    'WG-Inserat'
  ).replace(/\s+/g, ' ');

  // ── Address ───────────────────────────────────────────────────────────────
  // Structure: h2.section_panel_title("Adresse") lives inside .col-sm-6;
  // span.section_panel_detail with the address is a descendant of the same col.
  let address = '';

  $('h2.section_panel_title').each((_, el) => {
    if (!$(el).text().trim().toLowerCase().includes('adresse')) return;
    const col = $(el).closest('.col-sm-6');
    const span = col.find('span.section_panel_detail').first();
    if (span.length) {
      address = span.text().trim().replace(/\s+/g, ' ');
      return false; // break
    }
  });

  // Fallback: any section_panel_detail that looks like a postal address
  if (!address) {
    $('span.section_panel_detail').each((_, el) => {
      const text = $(el).text().trim();
      if (/\d{5}/.test(text) || /straße|strasse|weg|allee|platz|gasse/i.test(text)) {
        address = text.replace(/\s+/g, ' ');
        return false;
      }
    });
  }

  // ── Key facts (Zimmergröße, Gesamtmiete) ──────────────────────────────────
  // Structure: div.col-xs-6 > span.key_fact_detail + b.key_fact_value
  let warmRent: number | null = null;
  let size: number | null = null;

  $('span.key_fact_detail').each((_, el) => {
    const label = $(el).text().trim().toLowerCase();
    const value = $(el).closest('.col-xs-6').find('b.key_fact_value').text().trim();
    if (label.includes('gesamtmiete') || label.includes('warmmiete')) {
      warmRent = parseNumber(value);
    }
    if (label.includes('zimmergröße') || label.includes('wohnungsgröße') || label.includes('größe')) {
      size = parseNumber(value);
    }
  });

  // ── Cold rent (Miete:) ────────────────────────────────────────────────────
  let coldRent: number | null = null;
  $('span.section_panel_detail').each((_, el) => {
    if ($(el).text().trim().toLowerCase() === 'miete:') {
      const value = $(el).closest('.row').find('.section_panel_value, b').first();
      coldRent = parseNumber(value.text());
      return false;
    }
  });

  // ── Coordinates ───────────────────────────────────────────────────────────
  const { lat, lng } = extractCoordinates(html);

  return {
    url,
    title: title.slice(0, 200),
    address: address || 'Adresse nicht gefunden',
    warmRent,
    coldRent,
    size,
    lat,
    lng,
    scrapedAt: new Date().toISOString(),
  };
}
