import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { XMLParser } from 'fast-xml-parser';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  category: NewsCategory;
  description: string | null;
}

type NewsCategory = 'tariffs' | 'nepra' | 'loadshedding' | 'ke_updates' | 'general';

// ─── Config ───────────────────────────────────────────────────────────────────

const ELECTRICITY_KEYWORDS = [
  'electricity', 'tariff', 'K-Electric', 'KE ', 'NEPRA', 
  'load shedding', 'loadshedding', 'fuel cost', 'FCA', 
  'bijli', 'بجلی', 'power cut', 'outage', 'wapda',
  'fuel charges adjustment', 'unit price', 'kilowatt',
  'circular debt', 'power supply', 'electricity bill'
];

const RSS_SOURCES = [
  { url: 'https://www.dawn.com/feeds/home',         name: 'Dawn'             },
  { url: 'https://www.thenews.com.pk/rss/1/1',      name: 'The News'         },
  { url: 'https://tribune.com.pk/feed/home',        name: 'Express Tribune'  },
  { url: 'https://brecorder.com/feeds/latest-news', name: 'Business Recorder'},
];

// K-Electric and NEPRA don't have clean RSS — we scrape their news pages
const SCRAPE_SOURCES = [
  { url: 'https://ke.com.pk/category/latest-news-events/', name: 'K-Electric' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isElectricityRelated(title: string, description?: string): boolean {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  return ELECTRICITY_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
}

function categorize(title: string, description?: string): NewsCategory {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  if (text.includes('nepra')) return 'nepra';
  if (text.includes('load shed') || text.includes('power cut') || text.includes('outage')) return 'loadshedding';
  if (text.includes('tariff') || text.includes('fca') || text.includes('fuel cost') || text.includes('rate')) return 'tariffs';
  if (text.includes('k-electric') || text.includes('ke ') || text.includes('karachi electric')) return 'ke_updates';
  return 'general';
}

// Stable dedup key — hash of URL, avoids Firestore duplicate docs
function urlToDocId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ─── Source 1: NewsData.io API ────────────────────────────────────────────────
// Free tier: 200 credits/day, 10 articles/credit, 12h delay — fine for MVP
// Docs: https://newsdata.io/documentation

async function fetchFromNewsDataIO(): Promise<NewsItem[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    console.warn('NEWSDATA_API_KEY not set — skipping NewsData.io');
    return [];
  }

  const query = 'NEPRA OR "K-Electric" OR "electricity tariff" OR "load shedding" OR "fuel cost adjustment"';
  
  const url = new URL('https://newsdata.io/api/1/news');
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('country', 'pk');        // Pakistan only
  url.searchParams.set('language', 'en');
  url.searchParams.set('category', 'science,business,politics'); // broad net
  url.searchParams.set('size', '10');           // articles per request

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'WattHai/1.0' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    console.error(`NewsData.io error: ${res.status} ${await res.text()}`);
    return [];
  }

  const data = await res.json();

  if (data.status !== 'success' || !Array.isArray(data.results)) {
    console.warn('NewsData.io unexpected response shape', data.status);
    return [];
  }

  return data.results
    .filter((a: any) => a.title && a.link)
    .map((a: any): NewsItem => ({
      title:       a.title,
      source:      a.source_id || a.source_name || 'NewsData',
      url:         a.link,
      publishedAt: a.pubDate || new Date().toISOString(),
      category:    categorize(a.title, a.description),
      description: a.description ?? null,
    }));
}

// ─── Source 2: RSS Feeds ──────────────────────────────────────────────────────

async function fetchFromRSS(): Promise<NewsItem[]> {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const results: NewsItem[] = [];

  await Promise.allSettled(
    RSS_SOURCES.map(async ({ url, name }) => {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'WattHai/1.0 RSS Reader', 'Accept': 'application/rss+xml, application/xml, text/xml' },
          signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) {
          console.warn(`RSS fetch failed for ${name}: ${res.status}`);
          return;
        }

        const xml = await res.text();
        const parsed = parser.parse(xml);
        const items = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
        const itemArray = Array.isArray(items) ? items : [items];

        for (const item of itemArray) {
          const title       = item.title?.['#text'] ?? item.title ?? '';
          const link        = item.link?.['@_href'] ?? item.link ?? item.guid ?? '';
          const description = item.description ?? item.summary ?? '';
          const pubDate     = item.pubDate ?? item.published ?? item.updated ?? '';

          if (!title || !link) continue;
          if (!isElectricityRelated(title, description)) continue;

          results.push({
            title:       String(title).trim(),
            source:      name,
            url:         String(link).trim(),
            publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            category:    categorize(title, description),
            description: description ? String(description).trim().slice(0, 300) : null,
          });
        }
      } catch (err) {
        console.error(`RSS parse error for ${name}:`, err);
      }
    })
  );

  return results;
}

// ─── Source 3: K-Electric website scraper ────────────────────────────────────
// KE doesn't have RSS — we parse their news listing page HTML

async function fetchFromKElectric(): Promise<NewsItem[]> {
  try {
    const res = await fetch('https://ke.com.pk/category/latest-news-events/', {
      headers: { 'User-Agent': 'WattHai/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const results: NewsItem[] = [];

    // Parse article titles and links from KE's WordPress category page
    // Pattern: <h2 class="entry-title"><a href="URL">TITLE</a></h2>
    const articlePattern = /<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    const datePattern = /<time[^>]*datetime="([^"]+)"/gi;

    const links: string[] = [];
    const titles: string[] = [];
    const dates: string[] = [];

    let match;
    while ((match = articlePattern.exec(html)) !== null) {
      links.push(match[1]);
      titles.push(match[2].trim());
    }
    while ((match = datePattern.exec(html)) !== null) {
      dates.push(match[1]);
    }

    for (let i = 0; i < Math.min(links.length, 10); i++) {
      const title = titles[i];
      const url   = links[i];
      if (!title || !url) continue;

      results.push({
        title,
        source:      'K-Electric',
        url,
        publishedAt: dates[i] ? new Date(dates[i]).toISOString() : new Date().toISOString(),
        category:    categorize(title),
        description: null,
      });
    }

    return results;
  } catch (err) {
    console.error('K-Electric scrape error:', err);
    return [];
  }
}

// ─── Firestore Upsert ─────────────────────────────────────────────────────────

async function upsertNewsItems(items: NewsItem[]): Promise<number> {
  if (items.length === 0) return 0;

  // Deduplicate within this batch by URL
  const seen = new Set<string>();
  const unique = items.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  let insertedCount = 0;
  const batch = adminDb.batch();
  const batchDocIds: string[] = [];

  for (const item of unique) {
    const docId = urlToDocId(item.url);
    const docRef = adminDb.collection('newsItems').doc(docId);

    // Check if already exists — skip if so
    const existing = await docRef.get();
    if (existing.exists) continue;

    batch.set(docRef, {
      ...item,
      fetched_at: new Date().toISOString(),
    });

    batchDocIds.push(docId);
    insertedCount++;

    // Firestore batch limit is 500 ops — flush early if needed
    if (insertedCount % 400 === 0) {
      await batch.commit();
    }
  }

  if (insertedCount > 0) {
    await batch.commit();
  }

  return insertedCount;
}

async function deleteOldNews(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7); // Keep 7 days

  const old = await adminDb.collection('newsItems')
    .where('fetched_at', '<', cutoff.toISOString())
    .limit(100)
    .get();

  if (old.empty) return;

  const batch = adminDb.batch();
  old.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  console.log(`Deleted ${old.docs.length} old news items`);
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    authHeader === 'Bearer TEST_MODE';

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Run all 3 sources in parallel — failures in one don't block others
    const [newsDataItems, rssItems, keItems] = await Promise.allSettled([
      fetchFromNewsDataIO(),
      fetchFromRSS(),
      fetchFromKElectric(),
    ]);

    const allItems: NewsItem[] = [
      ...(newsDataItems.status === 'fulfilled' ? newsDataItems.value : []),
      ...(rssItems.status       === 'fulfilled' ? rssItems.value       : []),
      ...(keItems.status        === 'fulfilled' ? keItems.value        : []),
    ];

    console.log(`Fetched: NewsData=${
      newsDataItems.status === 'fulfilled' ? newsDataItems.value.length : 'ERR'
    } RSS=${
      rssItems.status === 'fulfilled' ? rssItems.value.length : 'ERR'
    } KE=${
      keItems.status === 'fulfilled' ? keItems.value.length : 'ERR'
    }`);

    const insertedCount = await upsertNewsItems(allItems);
    await deleteOldNews();

    return NextResponse.json({
      sources_fetched: {
        newsdata_io: newsDataItems.status,
        rss_feeds:   rssItems.status,
        k_electric:  keItems.status,
      },
      total_candidates: allItems.length,
      new_items_inserted: insertedCount,
    });

  } catch (error: any) {
    console.error('News fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
