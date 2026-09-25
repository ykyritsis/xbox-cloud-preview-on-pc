'use strict';

function decodeHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_entity, code) => {
    const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
    if (code[0] !== '#') return named[code.toLowerCase()] || ' ';
    const hex = code[1]?.toLowerCase() === 'x';
    const point = parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
  }).trim();
}

function safeSteamIcon(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol === 'http:') url.protocol = 'https:';
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (host === 'steamstatic.com' || host.endsWith('.steamstatic.com') || host.endsWith('.akamaihd.net') || host === 'media.steampowered.com') ? url.toString() : null;
  } catch { return null; }
}

function parseSteamCommunityAchievements(html, appId) {
  return String(html || '').split(/<div\s+class=["'][^"']*\bachieveRow\b[^"']*["']/i).slice(1, 251).map((chunk, index) => {
    const icon = safeSteamIcon(chunk.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]);
    const title = decodeHtml(chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]);
    const description = decodeHtml(chunk.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1]);
    const rarity = Number(chunk.match(/class=["'][^"']*\bachievePercent\b[^"']*["'][^>]*>\s*([\d.]+)%/i)?.[1]);
    return title ? { id: `${appId}-${index}`, title, description, icon, lockedIcon: null, unlocked: null, rarity: Number.isFinite(rarity) && rarity > 0 ? rarity : null } : null;
  }).filter(Boolean);
}

module.exports = { parseSteamCommunityAchievements, safeSteamIcon };
