/**
 * Application Configuration
 * Central place for configurable values that may change between environments
 */

// Zones available for user selection
export const ZONES = [
  { id: "1", en: "Defence", ur: "ڈیفنس" },
  { id: "2", en: "Clifton", ur: "کلفٹن" },
  { id: "3", en: "Gulistan-e-Johar", ur: "گلستانِ جوہر" },
  { id: "4", en: "Nazimabad", ur: "ناظم آباد" },
  { id: "5", en: "Gulshan-e-Iqbal", ur: "گلشنِ اقبال" },
  { id: "6", en: "PECHS", ur: "پی ای سی ایچ ایس" },
  { id: "7", en: "North Karachi", ur: "نارتھ کراچی" },
  { id: "8", en: "Korangi", ur: "کورنگی" },
  { id: "9", en: "Surjani", ur: "سرجانی" },
  { id: "10", en: "Malir", ur: "ملیر" },
  { id: "11", en: "Lyari", ur: "لیاری" },
  { id: "12", en: "Orangi", ur: "اورنگی" },
  { id: "13", en: "Other", ur: "دیگر" },
] as const;

export type Zone = typeof ZONES[number];

// Get zone by ID
export function getZoneById(id: string): Zone | undefined {
  return ZONES.find(z => z.id === id);
}

// Get zone display name based on locale
export function getZoneDisplayName(id: string, locale: 'en' | 'ur'): string {
  const zone = getZoneById(id);
  if (!zone) return 'Unknown';
  return locale === 'ur' ? zone.ur : zone.en;
}

// News sources configuration
export const NEWS_SOURCES = {
  rss: [
    { url: 'https://www.dawn.com/feeds/home', name: 'Dawn' },
    { url: 'https://www.thenews.com.pk/rss/1/1', name: 'The News' },
    { url: 'https://tribune.com.pk/feed/home', name: 'Express Tribune' },
    { url: 'https://brecorder.com/feeds/latest-news', name: 'Business Recorder' },
  ],
  scrape: [
    { url: 'https://ke.com.pk/category/latest-news-events/', name: 'K-Electric' },
  ],
} as const;

// Electricity-related keywords for news filtering
export const ELECTRICITY_KEYWORDS = [
  'electricity', 'tariff', 'K-Electric', 'KE ', 'NEPRA',
  'load shedding', 'loadshedding', 'fuel cost', 'FCA',
  'bijli', 'بجلی', 'power cut', 'outage', 'wapda',
  'fuel charges adjustment', 'unit price', 'kilowatt',
  'circular debt', 'power supply', 'electricity bill'
] as const;

// Outage reporting configuration
export const OUTAGE_CONFIG = {
  // Minimum reports needed before sending FCM notification
  fcmThreshold: 10,
  // Time window for considering outages as "recent" (hours)
  recentWindowHours: 2,
  // Minimum votes needed to check restoration status
  minRestorationVotes: 5,
  // Percentage of "yes" votes needed to mark as restored
  restorationThreshold: 0.6,
} as const;

// Bill analysis configuration
export const BILL_CONFIG = {
  // Minimum confidence score to auto-accept (0-1)
  minAutoAcceptConfidence: 0.7,
  // Maximum age of bill to allow editing (days)
  maxEditAgeDays: 7,
} as const;

// News categories
export type NewsCategory = 'tariffs' | 'nepra' | 'loadshedding' | 'ke_updates' | 'general';

export const NEWS_CATEGORIES: Record<NewsCategory, string> = {
  tariffs: 'Tariffs',
  nepra: 'NEPRA',
  loadshedding: 'Load Shedding',
  ke_updates: 'KE Updates',
  general: 'General',
};

// Application metadata
export const APP_CONFIG = {
  name: 'WattHai',
  tagline: 'Understand your bill. Save money.',
  version: '1.0.0',
} as const;
