const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_LENGTH = 300000;

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

function extractFirstUrl(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const match = text.trim().match(URL_REGEX);
  return match ? match[0].replace(/[.,;:!?)]+$/, '') : null;
}

function absoluteUrl(base, path) {
  if (!path || path.startsWith('data:')) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  try {
    return new URL(path, base).href;
  } catch {
    return null;
  }
}

function extractOg(html, pageUrl) {
  const result = { url: pageUrl, title: null, description: null, imageUrl: null };
  const lower = html.slice(0, MAX_HTML_LENGTH).toLowerCase();
  const getMeta = (name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["'](?:og:|twitter:)?${escaped}["'][^>]+content=["']([^"']+)["']`,
      'i'
    );
    const m = html.match(re);
    if (m) return m[1].trim();
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:|twitter:)?${escaped}["']`,
      'i'
    );
    const m2 = html.match(re2);
    return m2 ? m2[1].trim() : null;
  };
  result.title = getMeta('title') || getMeta('image:alt') || null;
  if (!result.title && lower.includes('<title')) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) result.title = titleMatch[1].trim().slice(0, 300);
  }
  result.description = getMeta('description') || null;
  result.imageUrl = getMeta('image') || null;
  if (result.imageUrl) result.imageUrl = absoluteUrl(pageUrl, result.imageUrl) || result.imageUrl;
  return result;
}

async function fetchLinkPreview(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(trimmed, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/119.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok || !/text\/html/i.test(res.headers.get('content-type') || '')) return null;
    const html = await res.text();
    const parsed = extractOg(html, res.url || trimmed);
    if (parsed.title || parsed.description || parsed.imageUrl) return parsed;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { extractFirstUrl, fetchLinkPreview };
