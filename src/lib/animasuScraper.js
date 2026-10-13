import axios from "axios";
import * as cheerio from "cheerio";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * Daftar domain fallback / mirror Animasu yang diketahui.
 * Jika domain utama diblokir / berganti, scraper akan otomatis mencoba mirror berikutnya.
 */
export const DEFAULT_ANIMASU_DOMAINS = [
  "https://animasu.love",
  "https://animasu.cc",
  "https://v2.animasu.work",
  "https://animasu.org",
  "https://animasu.net",
  "https://animasu.to",
  "https://animasu.tv"
];

/**
 * Cookie Jar sederhana untuk mempertahankan sesi HTTP.
 */
class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setCookiesFromHeaders(headers) {
    if (!headers) return;
    const raw = headers["set-cookie"];
    if (!raw) return;
    const arr = Array.isArray(raw) ? raw : [raw];
    for (const cookieStr of arr) {
      const parts = cookieStr.split(";")[0].split("=");
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join("=").trim();
        this.cookies.set(name, value);
      }
    }
  }

  getCookieHeader() {
    if (this.cookies.size === 0) return "";
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

/**
 * Provider detector berdasarkan hostname embed URL
 */
function detectProviderName(urlStr) {
  if (!urlStr) return "Unknown";
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase().replace(/^(www\.|player\.|play\.|embed\.)+/, "");
    
    if (host.includes("blogger.com") || host.includes("google.com/video")) return "Blogger";
    if (host.includes("vidhide") || host.includes("vidhidepro")) return "Vidhide";
    if (host.includes("yourupload")) return "YourUpload";
    if (host.includes("abyssplayer") || host.includes("short.ink") || host.includes("short.icu")) return "AbyssPlayer";
    if (host.includes("playhydrax") || host.includes("hydrax")) return "Hydrax";
    if (host.includes("gdriveplayer") || host.includes("drive.google")) return "Google Drive";
    if (host.includes("ok.ru") || host.includes("odnoklassniki")) return "OK.ru";
    if (host.includes("uservideo")) return "UserVideo";
    if (host.includes("mega.nz")) return "Mega";
    if (host.includes("vidoza")) return "Vidoza";
    if (host.includes("nanifile")) return "Nanifile";
    if (host.includes("bestx")) return "BestX";
    if (host.includes("fembed") || host.includes("feurl")) return "Fembed";
    if (host.includes("youtube") || host.includes("youtu.be")) return "YouTube";

    const baseName = host.split(".")[0];
    return baseName.charAt(0).toUpperCase() + baseName.slice(1);
  } catch {
    return "Unknown";
  }
}

/**
 * Normalisasi URL stream / embed sesuai patch JS bawaan Animasu
 */
function normalizeStreamUrl(urlStr) {
  if (!urlStr) return "";
  let u = urlStr.trim();
  if (u.startsWith("//")) {
    u = "https:" + u;
  }

  if (u.includes("uservideo.in")) u = u.replace(".in", ".xyz");
  if (u.includes("short.ink")) u = u.replace("short.ink", "abyssplayer.com");
  if (u.includes("short.icu")) u = u.replace("short.icu", "abyssplayer.com");
  if (u.includes("uservideo.nanime.in")) u = u.replace(".nanime.in", ".xyz");
  if (u.includes("nanime.yt")) u = u.replace(".yt", ".in");
  if (u.includes("uservideo.xyz") && !u.includes("new.uservideo.xyz")) {
    u = u.replace(/\./g, "-").replace("uservideo-xyz", "new.uservideo.xyz").replace("?embed=true", "/embed/?");
  }

  return u;
}

/**
 * Ekstraksi direct download URL berdasarkan pola provider Animasu (Script 18 & 19)
 */
function deriveDownloadUrl(embedUrl) {
  if (!embedUrl) return null;
  try {
    if (/vidhide/i.test(embedUrl)) {
      return embedUrl.replace("/v/", "/d/");
    }
    if (/yourupload\.com/i.test(embedUrl)) {
      return embedUrl.replace("/embed/", "/watch/");
    }
    if (/mega\.nz/i.test(embedUrl)) {
      let p = embedUrl.replace("https://mega.nz/embed/", "");
      if (p.includes("/")) p = "https://mega.nz/file/" + p.replace("/", "#");
      else p = "https://mega.nz/file/" + p;
      return p;
    }
    if (/bestx\.stream/i.test(embedUrl)) {
      return embedUrl.replace("/v/", "/d/");
    }
    if (/nanifile\.com/i.test(embedUrl)) {
      return embedUrl.replace("embed/", "");
    }
    if (/vidoza\.net/i.test(embedUrl)) {
      const idx = embedUrl.indexOf("?");
      const base = idx > -1 ? embedUrl.substring(0, idx) : embedUrl;
      return base.replace("embed-", "");
    }
    if (/fe(mbed|url|max\d*)\.com/i.test(embedUrl)) {
      return embedUrl.replace("/v/", "/f/");
    }
    if (/uservideo/i.test(embedUrl)) {
      return embedUrl.replace("?embed=true", "?autoplay=true").replace("/embed/", "/");
    }
    if (/ok\.ru/i.test(embedUrl)) {
      return embedUrl.replace("/videoembed/", "/video/");
    }
    if (/gdriveplayer\.to/i.test(embedUrl)) {
      return embedUrl.replace("embed2.php", "download2.php");
    }
    if (/blogger\.com\/video\.g/i.test(embedUrl)) {
      return embedUrl;
    }
  } catch {
  }
  return null;
}

/**
 * Mem-parse detail resolusi lengkap dari label server, HTML iframe, dan embed URL
 */
function parseResolutionDetails(optionText = "", rawHtml = "", embedUrl = "") {
  const text = (optionText || "").trim();

  const indexMatch = text.match(/\[(\d+)\]/);
  const serverIndex = indexMatch ? parseInt(indexMatch[1], 10) : 1;

  const qualities = [];
  const pMatches = text.matchAll(/(\d{3,4})p/gi);
  for (const m of pMatches) {
    qualities.push(`${m[1]}p`.toLowerCase());
  }

  if (/4k|uhd/i.test(text)) {
    qualities.push("2160p");
  }

  let iframeWidth = null;
  let iframeHeight = null;
  if (rawHtml) {
    const wMatch = rawHtml.match(/width=["']?(\d+)%?["']?/i);
    const hMatch = rawHtml.match(/height=["']?(\d+)%?["']?/i);
    if (wMatch && !rawHtml.includes('width="100%"')) iframeWidth = parseInt(wMatch[1], 10);
    if (hMatch && !rawHtml.includes('height="100%"')) iframeHeight = parseInt(hMatch[1], 10);
  }

  const resolutionSpecs = {
    "360p": { width: 640, height: 360, standard: "nHD", label: "360p (SD Low)", is_hd: false, is_fhd: false },
    "480p": { width: 854, height: 480, standard: "SD", label: "480p (Standard Definition)", is_hd: false, is_fhd: false },
    "720p": { width: 1280, height: 720, standard: "HD", label: "720p (High Definition)", is_hd: true, is_fhd: false },
    "1080p": { width: 1920, height: 1080, standard: "FHD", label: "1080p (Full High Definition)", is_hd: true, is_fhd: true },
    "1440p": { width: 2560, height: 1440, standard: "2K QHD", label: "1440p (Quad HD)", is_hd: true, is_fhd: true },
    "2160p": { width: 3840, height: 2160, standard: "4K UHD", label: "2160p (Ultra HD 4K)", is_hd: true, is_fhd: true },
  };

  if (qualities.length === 0) {
    const isMulti = /abyss|hydrax|gdrive|blogger/i.test(embedUrl);
    return {
      quality: isMulti ? "Multi-Quality" : "Auto",
      height: iframeHeight,
      width: iframeWidth,
      standard: isMulti ? "Multi-Quality" : "Adaptive",
      label: isMulti ? "Multi-Quality (Bisa pilih resolusi di player)" : "Auto / Default Quality",
      is_hd: isMulti,
      is_fhd: isMulti,
      is_multi_quality: isMulti,
      server_index: serverIndex,
      supported_qualities: isMulti ? ["360p", "480p", "720p", "1080p"] : [],
    };
  }

  if (qualities.length === 1) {
    const q = qualities[0];
    const spec = resolutionSpecs[q] || {
      width: iframeWidth,
      height: parseInt(q.replace("p", ""), 10) || null,
      standard: "Custom",
      label: q,
      is_hd: parseInt(q.replace("p", ""), 10) >= 720,
      is_fhd: parseInt(q.replace("p", ""), 10) >= 1080,
    };

    return {
      quality: q,
      height: spec.height,
      width: spec.width,
      standard: spec.standard,
      label: spec.label,
      is_hd: spec.is_hd,
      is_fhd: spec.is_fhd,
      is_multi_quality: false,
      server_index: serverIndex,
      supported_qualities: [q],
    };
  }

  const highestQ = qualities[qualities.length - 1];
  const highestSpec = resolutionSpecs[highestQ] || {};
  const hasHd = qualities.some((q) => (resolutionSpecs[q]?.is_hd || parseInt(q.replace("p", ""), 10) >= 720));
  const hasFhd = qualities.some((q) => (resolutionSpecs[q]?.is_fhd || parseInt(q.replace("p", ""), 10) >= 1080));

  return {
    quality: qualities.join(" & "),
    height: highestSpec.height || null,
    width: highestSpec.width || null,
    standard: hasFhd ? "FHD / Multi" : "HD / Multi",
    label: `Multi-Quality (${qualities.join(" / ")})`,
    is_hd: hasHd,
    is_fhd: hasFhd,
    is_multi_quality: true,
    server_index: serverIndex,
    supported_qualities: qualities,
  };
}

/**
 * Ekstraksi trailer YouTube dari berbagai elemen / link
 */
function extractYouTubeTrailer($, scope = null) {
  const root = scope ? $(scope) : $("body");
  
  const iframes = root.find("iframe[src*='youtube.com'], iframe[src*='youtu.be']");
  for (let i = 0; i < iframes.length; i++) {
    const src = $(iframes[i]).attr("src") || $(iframes[i]).attr("data-src") || "";
    if (src) {
      const match = src.match(/(?:embed\/|v\/|vi\/|youtu\.be\/|\?v=)([\w-]{11})/i);
      const videoId = match ? match[1] : null;
      return {
        video_id: videoId,
        embed_url: src.startsWith("//") ? "https:" + src : src,
        watch_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
      };
    }
  }

  const links = root.find("a[href*='youtube.com'], a[href*='youtu.be']");
  for (let i = 0; i < links.length; i++) {
    const href = $(links[i]).attr("href") || "";
    if (href) {
      const match = href.match(/(?:embed\/|v\/|vi\/|youtu\.be\/|\?v=)([\w-]{11})/i);
      const videoId = match ? match[1] : null;
      return {
        video_id: videoId,
        embed_url: videoId ? `https://www.youtube.com/embed/${videoId}` : href,
        watch_url: href,
      };
    }
  }

  return null;
}

/**
 * Class AnimasuScraper
 * Dirancang dengan sistem domain auto-discovery & resilience untuk menghadapi
 * situs Animasu yang sering berganti domain.
 */
export class AnimasuScraper {
  /**
   * @param {object} [options]
   * @param {string} [options.baseUrl] - Base domain default (default: https://animasu.love)
   * @param {string[]} [options.fallbackDomains] - List domain cadangan / mirror
   * @param {number} [options.timeout] - Timeout HTTP dalam ms (default: 25000)
   * @param {boolean} [options.autoResolveDomain] - Otomatis mendeteksi domain aktif jika down
   */
  constructor(options = {}) {
    this.primaryDomain = (options.baseUrl || "https://animasu.love").replace(/\/+$/, "");
    this.activeDomain = this.primaryDomain;
    this.fallbackDomains = options.fallbackDomains || DEFAULT_ANIMASU_DOMAINS;
    this.timeout = options.timeout || 25000;
    this.autoResolveDomain = options.autoResolveDomain ?? true;

    this.jar = new CookieJar();
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      maxRedirects: 10,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    this.axiosInstance.interceptors.request.use((config) => {
      const cookieHeader = this.jar.getCookieHeader();
      if (cookieHeader) config.headers["Cookie"] = cookieHeader;
      return config;
    });

    this.axiosInstance.interceptors.response.use((response) => {
      this.jar.setCookiesFromHeaders(response.headers);
      return response;
    });
  }

  /**
   * Mengatur base URL secara manual
   */
  setBaseUrl(newBaseUrl) {
    if (!newBaseUrl) return;
    this.activeDomain = newBaseUrl.replace(/\/+$/, "");
    if (!this.fallbackDomains.includes(this.activeDomain)) {
      this.fallbackDomains.unshift(this.activeDomain);
    }
  }

  /**
   * Mendapatkan domain yang saat ini aktif
   */
  getBaseUrl() {
    return this.activeDomain;
  }

  /**
   * HTTP Headers standar desktop browser
   */
  getHeaders(referer = "") {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Sec-Ch-Ua":
        '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    };
    if (referer) headers["Referer"] = referer;
    return headers;
  }

  /**
   * Menormalisasi URL target: jika menggunakan domain lama Animasu atau relatif,
   * otomatis diubah ke activeDomain saat ini.
   */
  normalizeTargetUrl(inputUrl) {
    if (!inputUrl) return this.activeDomain;
    let trimmed = inputUrl.trim();

    if (!trimmed.includes("/") && !trimmed.startsWith("http")) {
      return `${this.activeDomain}/anime/${trimmed}/`;
    }

    if (trimmed.startsWith("/")) {
      return `${this.activeDomain}${trimmed}`;
    }

    try {
      const parsed = new URL(trimmed);
      const isAnimasuHost = this.fallbackDomains.some((d) => {
        try {
          return new URL(d).hostname === parsed.hostname;
        } catch {
          return false;
        }
      }) || parsed.hostname.includes("animasu");

      if (isAnimasuHost) {
        const activeHost = new URL(this.activeDomain).origin;
        return `${activeHost}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
    }

    return trimmed;
  }

  /**
   * Cek kesehatan dan temukan domain aktif Animasu secara otomatis
   */
  async resolveActiveDomain() {
    const testList = [this.activeDomain, ...this.fallbackDomains.filter(d => d !== this.activeDomain)];
    
    for (const domain of testList) {
      try {
        const resp = await this.axiosInstance.get(domain, {
          headers: this.getHeaders(),
          timeout: 7000,
          maxRedirects: 5,
        });

        if (resp.status === 200) {
          const finalUrl = resp.request?.res?.responseUrl || resp.config?.url || domain;
          try {
            const finalOrigin = new URL(finalUrl).origin;
            this.activeDomain = finalOrigin;
            return this.activeDomain;
          } catch {
            this.activeDomain = domain;
            return domain;
          }
        }
      } catch {
        continue;
      }
    }

    return this.activeDomain;
  }

  /**
   * Mengambil konten HTML dengan mekanisme auto-retry dan domain fallback
   */
  async fetchHTML(targetUrl, referer = "") {
    let normalizedUrl = this.normalizeTargetUrl(targetUrl);
    let attempts = 0;
    const maxAttempts = this.fallbackDomains.length;

    while (attempts < maxAttempts) {
      try {
        const resp = await this.axiosInstance.get(normalizedUrl, {
          headers: this.getHeaders(referer),
          responseType: "text",
        });

        const finalUrl = resp.request?.res?.responseUrl || resp.config?.url;
        if (finalUrl) {
          try {
            const finalOrigin = new URL(finalUrl).origin;
            if (finalOrigin !== this.activeDomain && finalOrigin.includes("animasu")) {
              this.activeDomain = finalOrigin;
            }
          } catch {}
        }

        return {
          html: typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data),
          statusCode: resp.status,
          finalUrl: finalUrl || normalizedUrl,
          error: null,
        };
      } catch (err) {
        attempts++;
        if (this.autoResolveDomain && attempts < maxAttempts) {
          const nextDomain = this.fallbackDomains[attempts % this.fallbackDomains.length];
          try {
            const parsed = new URL(normalizedUrl);
            const nextOrigin = new URL(nextDomain).origin;
            normalizedUrl = `${nextOrigin}${parsed.pathname}${parsed.search}`;
            this.activeDomain = nextOrigin;
          } catch {
            break;
          }
        } else {
          return {
            html: "",
            statusCode: err.response ? err.response.status : 0,
            finalUrl: normalizedUrl,
            error: err.message || "Failed to fetch HTML",
          };
        }
      }
    }

    return {
      html: "",
      statusCode: 0,
      finalUrl: normalizedUrl,
      error: "All domain fallback attempts failed",
    };
  }

  /**
   * Ekstraksi server streaming dari sebuah halaman episode / film
   * @param {string} episodeUrlOrSlug - URL episode (misal: /nonton-xxx-episode-1/)
   */
  async getEpisode(episodeUrlOrSlug) {
    const targetUrl = this.normalizeTargetUrl(episodeUrlOrSlug);
    const { html, statusCode, error, finalUrl } = await this.fetchHTML(targetUrl);

    if (error || !html) {
      return {
        success: false,
        status_code: statusCode,
        error: error || "Empty HTML response",
        timestamp: new Date().toISOString(),
      };
    }

    const $ = cheerio.load(html);
    const title = $("h1.entry-title, h1").first().text().trim();

    const prevUrl = $(".naveps .prev a, .navig .prev a, a:contains('Sebelumnya')").attr("href") || null;
    const nextUrl = $(".naveps .next a, .navig .next a, a:contains('Selanjutnya')").attr("href") || null;
    const allEpisodesUrl = $(".naveps .nv-eps a, .navig .nv-eps a, .all-eps a").attr("href") || null;

    const streams = [];
    const seenEmbeds = new Set();

    $("select.mirror option, select#mirror option, .server-select option").each((_, el) => {
      const optionText = $(el).text().trim();
      const rawVal = $(el).attr("value") || "";

      if (!rawVal || rawVal.length < 5) return;

      let decodedHtml = "";
      try {
        decodedHtml = Buffer.from(rawVal, "base64").toString("utf-8");
      } catch {
        decodedHtml = rawVal;
      }

      const srcMatch = decodedHtml.match(/src=["']([^"']+)["']/i);
      if (srcMatch && srcMatch[1]) {
        const rawEmbedUrl = srcMatch[1];
        const normalizedEmbed = normalizeStreamUrl(rawEmbedUrl);
        const provider = detectProviderName(normalizedEmbed);
        const directDownload = deriveDownloadUrl(normalizedEmbed);
        const resolution = parseResolutionDetails(optionText, decodedHtml, normalizedEmbed);

        if (!seenEmbeds.has(normalizedEmbed)) {
          seenEmbeds.add(normalizedEmbed);
          streams.push({
            server_name: optionText,
            provider,
            quality: resolution.quality,
            resolution: {
              quality: resolution.quality,
              label: resolution.label,
              standard: resolution.standard,
              height: resolution.height,
              width: resolution.width,
              is_hd: resolution.is_hd,
              is_fhd: resolution.is_fhd,
              is_multi_quality: resolution.is_multi_quality,
              server_index: resolution.server_index,
              supported_qualities: resolution.supported_qualities,
            },
            embed_url: normalizedEmbed,
            download_url: directDownload,
            raw_html: decodedHtml,
          });
        }
      }
    });

    const defaultIframeSrc = $("#pembed iframe").attr("src") || $("iframe#pframe").attr("src") || "";
    if (defaultIframeSrc) {
      const normalizedEmbed = normalizeStreamUrl(defaultIframeSrc);
      if (!seenEmbeds.has(normalizedEmbed)) {
        seenEmbeds.add(normalizedEmbed);
        const provider = detectProviderName(normalizedEmbed);
        const resolution = parseResolutionDetails("Default Player", `<iframe src="${normalizedEmbed}"></iframe>`, normalizedEmbed);

        streams.unshift({
          server_name: "Default Player",
          provider,
          quality: resolution.quality,
          resolution: {
            quality: resolution.quality,
            label: resolution.label,
            standard: resolution.standard,
            height: resolution.height,
            width: resolution.width,
            is_hd: resolution.is_hd,
            is_fhd: resolution.is_fhd,
            is_multi_quality: resolution.is_multi_quality,
            server_index: resolution.server_index,
            supported_qualities: resolution.supported_qualities,
          },
          embed_url: normalizedEmbed,
          download_url: deriveDownloadUrl(normalizedEmbed),
          raw_html: `<iframe src="${normalizedEmbed}"></iframe>`,
        });
      }
    }

    const cleanEpisodeTitle = title.replace(/\s*(?:Sub(?:title)?\s*Indo(?:nesia)?)\s*$/i, "").trim() || title;
    const seriesUrl = $("a:contains('Informasi Anime')").attr("href") || $(".naveps .nv-eps a, .navig .nv-eps a, .all-eps a").attr("href") || null;
    const publishedAt = $("meta[itemprop='datePublished']").attr("content") || null;
    const modifiedAt = $("meta[itemprop='dateModified']").attr("content") || null;

    return {
      success: true,
      status_code: statusCode,
      data: {
        title: cleanEpisodeTitle,
        raw_title: title,
        url: finalUrl,
        series_url: seriesUrl ? this.normalizeTargetUrl(seriesUrl) : null,
        published_at: publishedAt,
        modified_at: modifiedAt,
        prev_episode_url: prevUrl ? this.normalizeTargetUrl(prevUrl) : null,
        next_episode_url: nextUrl ? this.normalizeTargetUrl(nextUrl) : null,
        total_streams: streams.length,
        streams,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Ekstraksi detail lengkap anime: Poster, Judul, Deskripsi, Sinopsis, Detail, Genre,
   * Trailer YouTube, dan Seluruh Daftar Episode/Movie/ONA/OVA.
   * 
   * @param {string} urlOrSlug - URL anime (misal: https://animasu.love/anime/kusuriya-no-hitorigoto-s3/ atau slug)
   * @param {object} [options]
   * @param {boolean} [options.fetchStreams] - Jika true, otomatis ambil server streaming untuk setiap episode
   * @param {number} [options.streamLimit] - Batas maksimal episode yang diambil stream-nya jika fetchStreams true (default: all)
   */
  async extract(urlOrSlug, options = {}) {
    const targetUrl = this.normalizeTargetUrl(urlOrSlug);
    const { html, statusCode, error, finalUrl } = await this.fetchHTML(targetUrl);

    if (error || !html) {
      return {
        success: false,
        status_code: statusCode,
        error: error || "Empty HTML response",
        timestamp: new Date().toISOString(),
      };
    }

    const $ = cheerio.load(html);

    const rawTitle = $(".infox h1").text().trim() ||
                     $("h1.entry-title").text().trim() ||
                     $("h1[itemprop='headline']").text().trim() ||
                     $("h1").first().text().trim();
    
    const title = rawTitle.replace(/\s*(?:Sub(?:title)?\s*Indo(?:nesia)?)\s*$/i, "").trim() || rawTitle;
    const japaneseTitle = $(".alter").text().trim() || null;

    let poster = $(".thumb img").attr("src") ||
                 $(".poster img").attr("src") ||
                 $("img.wp-post-image").attr("src") ||
                 $("meta[property='og:image']").attr("content") ||
                 null;

    let posterClean = poster;
    if (poster && poster.includes("wp.com/")) {
      posterClean = poster.replace(/^https?:\/\/i\d+\.wp\.com\//i, "https://");
    }

    const rawScore = $(".rating strong").text().replace(/Rating\s*/i, "").trim() ||
                     $("[itemprop='ratingValue']").text().trim() ||
                     null;
    let score = null;
    if (rawScore && rawScore.toUpperCase() !== "N/A") {
      const num = parseFloat(rawScore);
      score = !isNaN(num) ? num : rawScore;
    }

    let synopsis = $(".sinopsis p").map((_, el) => $(el).text().trim()).get().join("\n\n") ||
                   $(".entry-content[itemprop='description'] p").map((_, el) => $(el).text().trim()).get().join("\n\n") ||
                   $(".desc p").text().trim() ||
                   $(".entry-content p").text().trim() ||
                   "";

    const metadata = {};
    const genres = [];
    const characterTags = [];
    let franchiseUrl = null;

    $(".spe span").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      const boldKey = $(el).find("b").text().replace(":", "").trim().toLowerCase();

      const franchiseLink = $(el).find("a[href*='/serial/']").attr("href");
      if (franchiseLink) {
        franchiseUrl = this.normalizeTargetUrl(franchiseLink);
        return;
      }

      if (boldKey === "genre") {
        $(el).find("a").each((_, a) => {
          genres.push({
            name: $(a).text().trim(),
            url: this.normalizeTargetUrl($(a).attr("href") || ""),
          });
        });
      } else if (boldKey === "karakter") {
        $(el).find("a").each((_, a) => {
          const cName = $(a).text().trim();
          const cUrl = $(a).attr("href");
          if (cName && !cName.toLowerCase().includes("tambahkan") && !cName.toLowerCase().includes("tampilkan")) {
            characterTags.push({
              name: cName,
              url: this.normalizeTargetUrl(cUrl || ""),
            });
          }
        });
        const val = $(el).clone().children("b").remove().end().text().trim();
        metadata[boldKey] = val;
      } else if (boldKey) {
        const val = $(el).clone().children("b").remove().end().text().trim();
        metadata[boldKey] = val;
      } else {
        const parts = text.split(":");
        if (parts.length >= 2) {
          const k = parts[0].trim().toLowerCase();
          const v = parts.slice(1).join(":").trim();
          metadata[k] = v;
        }
      }
    });

    if (genres.length === 0) {
      $(".genre-info a, .infox .genre-info a").each((_, a) => {
        genres.push({
          name: $(a).text().trim(),
          url: this.normalizeTargetUrl($(a).attr("href") || ""),
        });
      });
    }

    const studioElem = $(".spe span b:contains('Studio')").parent().find("a");
    const studio = studioElem.text().trim() || metadata["studio"] || null;
    const studioUrl = studioElem.attr("href") ? this.normalizeTargetUrl(studioElem.attr("href")) : null;

    const authorElem = $(".spe span b:contains('Pengarang')").parent().find("a");
    const authorName = authorElem.text().trim() || metadata["pengarang"] || metadata["author"] || null;
    const authorUrl = authorElem.attr("href") ? this.normalizeTargetUrl(authorElem.attr("href")) : null;
    const author = authorName ? (authorUrl ? { name: authorName, url: authorUrl } : { name: authorName, url: null }) : null;

    const rawStatus = metadata["status"] || null;
    const cleanStatus = rawStatus ? rawStatus.replace(/[\u{1F300}-\u{1F9FF}|🔥|✓|⭐]/gu, "").trim() : null;
    const isOngoing = rawStatus ? /sedang tayang/i.test(rawStatus) : false;

    const rawChar = metadata["karakter"] || null;
    const cleanChar = (rawChar && !rawChar.toLowerCase().includes("tambahkan") && !rawChar.includes("[ Tampilkan ]")) ? rawChar : null;

    let detectedType = metadata["jenis"] || metadata["type"] || null;
    if (!detectedType) {
      const badgeType = $(".type, .typez, .status.type").first().text().trim();
      if (badgeType) detectedType = badgeType;
    }
    if (!detectedType) {
      if (/\bmovie\b/i.test(title) || /\bmovie\b/i.test(targetUrl)) detectedType = "Movie";
      else if (/\bova\b/i.test(title) || /\bova\b/i.test(targetUrl)) detectedType = "OVA";
      else if (/\bona\b/i.test(title) || /\bona\b/i.test(targetUrl)) detectedType = "ONA";
      else if (/\bspecial\b/i.test(title) || /\bspecial\b/i.test(targetUrl)) detectedType = "Special";
      else detectedType = "Serial TV";
    }

    const trailer = extractYouTubeTrailer($, ".trailer, .bixbox.trailer, #trailer, .infox");

    const batchDownloads = [];
    $(".soraurlx").each((_, el) => {
      const resLabel = $(el).find("strong, b").first().text().trim();
      const links = [];
      $(el).find("a").each((_, a) => {
        const sName = $(a).text().trim();
        const sUrl = $(a).attr("href");
        if (sUrl && sName) {
          links.push({
            server_name: sName,
            url: sUrl,
          });
        }
      });
      if (links.length > 0) {
        batchDownloads.push({
          resolution: resLabel || "Unknown",
          links,
        });
      }
    });

    const rawEpisodes = [];
    $(".listeps li, #daftarepisode li, .episodes-list li, .episodelist li").each((i, el) => {
      const a = $(el).find("a").first();
      const epUrl = a.attr("href") || $(el).find("a[href*='nonton-']").attr("href");
      if (!epUrl) return;

      const epTitle = $(el).find(".lchx a").text().trim() || a.text().trim();
      const epDate = $(el).find(".date, .dt").first().text().trim();

      const numMatch = epTitle.match(/(?:Episode|Ep\.?|E)\s*([\d.]+)/i);
      const epNumber = numMatch ? parseFloat(numMatch[1]) : (rawEpisodes.length + 1);

      rawEpisodes.push({
        episode_number: epNumber,
        title: epTitle,
        url: this.normalizeTargetUrl(epUrl),
        release_date: epDate || null,
      });
    });

    const episodes = rawEpisodes;

    if (options.fetchStreams && episodes.length > 0) {
      const limit = options.streamLimit || episodes.length;
      const targetEpisodes = episodes.slice(0, limit);

      const concurrency = options.concurrency || 3;
      for (let i = 0; i < targetEpisodes.length; i += concurrency) {
        const chunk = targetEpisodes.slice(i, i + concurrency);
        await Promise.all(
          chunk.map(async (ep) => {
            try {
              const epData = await this.getEpisode(ep.url);
              if (epData.success && epData.data) {
                ep.streams = epData.data.streams;
              }
            } catch {
              ep.streams = [];
            }
          })
        );
      }
    }

    return {
      success: true,
      status_code: statusCode,
      data: {
        title,
        raw_title: rawTitle,
        japanese_title: japaneseTitle,
        type: detectedType,
        poster,
        poster_clean: posterClean,
        score,
        raw_score: rawScore,
        synopsis,
        description: synopsis,
        desc: synopsis,
        details: {
          status: cleanStatus || rawStatus,
          raw_status: rawStatus,
          is_ongoing: isOngoing,
          type: detectedType,
          release_date: metadata["rilis"] || metadata["release"] || null,
          duration: metadata["durasi"] || metadata["duration"] || null,
          season: metadata["musim"] || metadata["season"] || null,
          character_type: cleanChar,
          character_tags: characterTags,
          author,
          total_episodes_text: metadata["episode"] || null,
          studio: studio ? { name: studio, url: studioUrl } : null,
          posted_by: metadata["diposting"] || null,
          updated_at: metadata["diupdate"] || null,
        },
        genres,
        trailer,
        franchise_url: franchiseUrl,
        total_episodes: episodes.length,
        batch_downloads: batchDownloads.length > 0 ? batchDownloads : undefined,
        episodes,
      },
      url: finalUrl,
      active_domain: this.activeDomain,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Menormalkan nama atau slug genre ke format canonical slug Animasu.
   * Mendukung sinonim umum bahasa Indonesia dan Inggris.
   * 
   * @param {string} input - Nama genre atau slug (misal 'Action', 'aksi', 'robot', 'mecha')
   * @returns {string} Canonical slug Animasu
   */
  resolveGenreSlug(input) {
    if (!input) return "";
    let clean = String(input).trim().toLowerCase();
    if (clean.includes("/genre/")) {
      const match = clean.match(/\/genre\/([^/]+)/);
      if (match) clean = match[1];
    }
    const slugMap = {
      action: "aksi",
      aksi: "aksi",
      comedy: "komedi",
      komedi: "komedi",
      romance: "romansa",
      romantis: "romansa",
      romansa: "romansa",
      fantasy: "fantasi",
      fantasi: "fantasi",
      adventure: "petualangan",
      petualangan: "petualangan",
      robot: "mecha",
      mecha: "mecha",
      antariksa: "luar-angkasa",
      space: "luar-angkasa",
      "luar-angkasa": "luar-angkasa",
      medis: "medical",
      medical: "medical",
      school: "sekolahan",
      sekolah: "sekolahan",
      sekolahan: "sekolahan",
      military: "militer",
      militer: "militer",
      supernatural: "supranatural",
      supranatural: "supranatural",
      mystery: "misteri",
      misteri: "misteri",
      sports: "olahraga",
      sport: "olahraga",
      olahraga: "olahraga",
      magic: "sihir",
      sihir: "sihir",
      historical: "sejarah",
      sejarah: "sejarah",
      ketegangan: "suspense",
      suspense: "suspense",
      reinkarnasi: "reincarnation",
      reincarnation: "reincarnation",
      dimensia: "dementia",
      dementia: "dementia",
      kids: "anak-anak",
      "anak-anak": "anak-anak",
    };
    if (slugMap[clean]) return slugMap[clean];
    return clean.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  }

  /**
   * Mengambil daftar lengkap seluruh genre anime yang tersedia di Animasu
   * Sumber: /kumpulan-genre-anime-lengkap/
   * 
   * @returns {Promise<object>} Objek berisi daftar genre beserta slug dan URL
   */
  async getGenres() {
    const listUrl = `${this.activeDomain}/kumpulan-genre-anime-lengkap/`;
    const { html, statusCode, error, finalUrl } = await this.fetchHTML(listUrl);

    const genreList = [];
    if (html && !error) {
      const $ = cheerio.load(html);
      $("a[href*='/genre/']").each((_, el) => {
        const href = $(el).attr("href");
        const name = $(el).text().trim();
        if (href && name) {
          const match = href.match(/\/genre\/([^/]+)\/?/);
          const slug = match ? match[1] : null;
          if (slug && !genreList.some((g) => g.slug === slug)) {
            genreList.push({
              name,
              slug,
              url: this.normalizeTargetUrl(href),
            });
          }
        }
      });
    }

    if (genreList.length === 0) {
      const fallbackList = [
        { name: "Donghua", slug: "donghua" },
        { name: "Aksi", slug: "aksi" },
        { name: "Anak-Anak", slug: "anak-anak" },
        { name: "Antariksa", slug: "luar-angkasa" },
        { name: "Avant Garde", slug: "avant-garde" },
        { name: "Dimensia", slug: "dementia" },
        { name: "Drama", slug: "drama" },
        { name: "Ecchi", slug: "ecchi" },
        { name: "Fantasi", slug: "fantasi" },
        { name: "Fantasi Urban", slug: "fantasi-urban" },
        { name: "Game", slug: "game" },
        { name: "Gourmet", slug: "gourmet" },
        { name: "Harem", slug: "harem" },
        { name: "Horror", slug: "horror" },
        { name: "Iblis", slug: "iblis" },
        { name: "Isekai", slug: "isekai" },
        { name: "Josei", slug: "josei" },
        { name: "Ketegangan", slug: "suspense" },
        { name: "Komedi", slug: "komedi" },
        { name: "Live Action", slug: "live-action" },
        { name: "Makanan", slug: "makanan" },
        { name: "Martial Arts", slug: "martial-arts" },
        { name: "Medis", slug: "medical" },
        { name: "Militer", slug: "militer" },
        { name: "Misteri", slug: "misteri" },
        { name: "Mitologi", slug: "mitologi" },
        { name: "Mobil", slug: "mobil" },
        { name: "Musik", slug: "musik" },
        { name: "Olahraga", slug: "olahraga" },
        { name: "Parodi", slug: "parodi" },
        { name: "Perang", slug: "perang" },
        { name: "Petualangan", slug: "petualangan" },
        { name: "Polisi", slug: "polisi" },
        { name: "Politik", slug: "politik" },
        { name: "Psikologis", slug: "psikologis" },
        { name: "Reinkarnasi", slug: "reincarnation" },
        { name: "Robot", slug: "mecha" },
        { name: "Romansa", slug: "romansa" },
        { name: "Samurai", slug: "samurai" },
        { name: "Sci-Fi", slug: "sci-fi" },
        { name: "Seinen", slug: "seinen" },
        { name: "Sejarah", slug: "sejarah" },
        { name: "Sekolahan", slug: "sekolahan" },
        { name: "Shoujo", slug: "shoujo" },
        { name: "Shoujo Ai", slug: "shoujo-ai" },
        { name: "Shounen", slug: "shounen" },
        { name: "Shounen Ai", slug: "shounen-ai" },
        { name: "Sihir", slug: "sihir" },
        { name: "Slice of Life", slug: "slice-of-life" },
        { name: "Super Power", slug: "super-power" },
        { name: "Supranatural", slug: "supranatural" },
        { name: "Thriller", slug: "thriller" },
        { name: "Time Travel", slug: "time-travel" },
        { name: "Vampir", slug: "vampir" },
        { name: "Wuxia", slug: "wuxia" },
        { name: "Yaoi", slug: "yaoi" },
      ];
      for (const item of fallbackList) {
        genreList.push({
          name: item.name,
          slug: item.slug,
          url: `${this.activeDomain}/genre/${item.slug}/`,
        });
      }
    }

    return {
      success: true,
      status_code: statusCode || 200,
      total: genreList.length,
      data: genreList,
      url: finalUrl || listUrl,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Menjelajahi anime berdasarkan 1 genre spesifik (contoh: 'aksi', 'donghua', 'isekai', dsb).
   * URL target: /genre/{slug}/page/{page}/
   * 
   * @param {string} genreSlugOrUrl - Slug genre (misal 'aksi') atau URL genre
   * @param {number} [page=1] - Nomor halaman
   */
  async getByGenre(genreSlugOrUrl, page = 1) {
    if (!genreSlugOrUrl) {
      return { success: false, error: "Genre slug atau URL wajib diisi" };
    }
    const cleanSlug = this.resolveGenreSlug(genreSlugOrUrl);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const targetUrl = pageNum > 1
      ? `${this.activeDomain}/genre/${cleanSlug}/page/${pageNum}/`
      : `${this.activeDomain}/genre/${cleanSlug}/`;

    const { html, statusCode, error, finalUrl } = await this.fetchHTML(targetUrl);
    if (error || !html) {
      return { success: false, status_code: statusCode, error };
    }

    const $ = cheerio.load(html);
    const items = [];

    $(".listupd article, .animepost, .bsx").each((_, el) => {
      const a = $(el).find("a").first();
      const href = a.attr("href");
      if (!href) return;

      const title = $(el).find(".tt, .title, h2, h4").text().trim() || a.attr("title") || "";
      const type = $(el).find(".type, .typez").text().trim() || null;
      const episode = $(el).find(".epx, .status").text().trim() || null;
      const badge = $(el).find(".sb").text().trim() || null;
      const rawThumb = $(el).find("img").attr("src") || $(el).find("img").attr("data-src") || null;
      let cleanThumb = rawThumb;
      if (rawThumb && rawThumb.includes("wp.com/")) {
        cleanThumb = rawThumb.replace(/^https?:\/\/i\d+\.wp\.com\//i, "https://");
      }

      items.push({
        title,
        url: this.normalizeTargetUrl(href),
        type,
        status: episode,
        badge,
        thumbnail: rawThumb,
        thumbnail_clean: cleanThumb,
      });
    });

    let totalPages = pageNum;
    $(".page-numbers").each((_, el) => {
      const pText = $(el).text().trim();
      const pNum = parseInt(pText, 10);
      if (!isNaN(pNum) && pNum > totalPages) {
        totalPages = pNum;
      }
    });

    const hasNext = $(".next.page-numbers").length > 0;
    const hasPrev = $(".prev.page-numbers").length > 0 || pageNum > 1;

    return {
      success: true,
      status_code: statusCode,
      genre: {
        slug: cleanSlug,
        url: `${this.activeDomain}/genre/${cleanSlug}/`,
      },
      page: pageNum,
      total_pages: totalPages,
      has_next_page: hasNext,
      has_prev_page: hasPrev,
      total_items: items.length,
      data: items,
      url: finalUrl,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Filter pencarian lanjutan Animasu dengan multi-genre, status, tipe, urutan, season, dan pagination.
   * Menggunakan endpoint resmi Animasu: /pencarian/
   * 
   * @param {object} [filters]
   * @param {string|string[]} [filters.genres] - Satu atau banyak genre (misal ['aksi', 'komedi'] atau 'aksi')
   * @param {string|string[]} [filters.genre] - Alias untuk filters.genres
   * @param {string} [filters.status] - 'ongoing' (Sedang Tayang), 'completed' (Selesai Tayang), 'upcoming' (Segera), atau '' (Semua)
   * @param {string} [filters.type] - 'TV', 'Movie', 'OVA', 'ONA', 'Special', 'Live Action', 'Music', dsb
   * @param {string} [filters.tipe] - Alias untuk filters.type
   * @param {string} [filters.order] - 'update', 'publikasi', 'populer', 'rating', 'abjad', 'dari-z', 'baru', 'lama', 'default'
   * @param {string} [filters.urutan] - Alias untuk filters.order
   * @param {string|string[]} [filters.season] - Musim rilis, misal 'spring-2025', 'winter-2025'
   * @param {number} [filters.page] - Nomor halaman (default: 1)
   * @param {number} [filters.halaman] - Alias untuk filters.page
   * @param {number} [page=1] - Nomor halaman opsional
   */
  async searchAdvanced(filters = {}, page = 1) {
    const pageNum = Math.max(1, parseInt(filters.page || filters.halaman || page, 10) || 1);
    const params = new URLSearchParams();

    let rawGenres = filters.genres || filters.genre || [];
    if (typeof rawGenres === "string") {
      rawGenres = rawGenres.split(",").map((s) => s.trim()).filter(Boolean);
    }
    const genreSlugs = Array.isArray(rawGenres)
      ? rawGenres.map((g) => this.resolveGenreSlug(g)).filter(Boolean)
      : [];

    genreSlugs.forEach((slug, idx) => {
      params.append(`genre[${idx}]`, slug);
    });

    let status = (filters.status || "").toLowerCase().trim();
    if (status.includes("sedang") || status.includes("airing") || status === "ongoing") status = "ongoing";
    else if (status.includes("selesai") || status.includes("tamat") || status === "completed") status = "completed";
    else if (status.includes("segera") || status === "upcoming") status = "upcoming";
    else if (status === "all" || status === "semua") status = "";
    if (status) params.set("status", status);

    let tipe = filters.type || filters.tipe || "";
    if (tipe && tipe.toLowerCase() !== "all" && tipe.toLowerCase() !== "semua") {
      params.set("tipe", tipe);
    }

    let urutan = (filters.order || filters.urutan || "update").toLowerCase().trim();
    if (urutan === "popular") urutan = "populer";
    if (urutan === "newest") urutan = "baru";
    if (urutan === "oldest") urutan = "lama";
    params.set("urutan", urutan);

    if (filters.season) {
      const seasons = Array.isArray(filters.season) ? filters.season : [filters.season];
      seasons.forEach((s, idx) => {
        params.append(`season[${idx}]`, s);
      });
    }

    if (pageNum > 1) {
      params.set("halaman", pageNum);
    }

    const searchUrl = `${this.activeDomain}/pencarian/?${params.toString()}`;
    const { html, statusCode, error, finalUrl } = await this.fetchHTML(searchUrl);

    if (error || !html) {
      return { success: false, status_code: statusCode, error };
    }

    const $ = cheerio.load(html);
    const items = [];

    $(".listupd article, .animepost, .bsx").each((_, el) => {
      const a = $(el).find("a").first();
      const href = a.attr("href");
      if (!href) return;

      const title = $(el).find(".tt, .title, h2, h4").text().trim() || a.attr("title") || "";
      const type = $(el).find(".type, .typez").text().trim() || null;
      const episode = $(el).find(".epx, .status").text().trim() || null;
      const badge = $(el).find(".sb").text().trim() || null;
      const rawThumb = $(el).find("img").attr("src") || $(el).find("img").attr("data-src") || null;
      let cleanThumb = rawThumb;
      if (rawThumb && rawThumb.includes("wp.com/")) {
        cleanThumb = rawThumb.replace(/^https?:\/\/i\d+\.wp\.com\//i, "https://");
      }

      items.push({
        title,
        url: this.normalizeTargetUrl(href),
        type,
        status: episode,
        badge,
        thumbnail: rawThumb,
        thumbnail_clean: cleanThumb,
      });
    });

    const hasNext = $("a.r:contains('Selanjutnya'), a:contains('Selanjutnya')").length > 0;
    const hasPrev = $("a.l:contains('Kembali'), a:contains('Kembali')").length > 0 || pageNum > 1;

    return {
      success: true,
      status_code: statusCode,
      page: pageNum,
      has_next_page: hasNext,
      has_prev_page: hasPrev,
      next_page: hasNext ? pageNum + 1 : null,
      prev_page: hasPrev && pageNum > 1 ? pageNum - 1 : null,
      total_items: items.length,
      filters_applied: {
        genres: genreSlugs,
        status: status || "semua",
        type: tipe || "semua",
        order: urutan,
      },
      data: items,
      url: finalUrl,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Alias praktis untuk pencarian berdasarkan 1 atau beberapa genre
   * @param {string|string[]} genres - Genre atau daftar genre (misal 'aksi' atau ['aksi', 'komedi'])
   * @param {object} [options] - Opsi filter tambahan (status, type, order, page)
   */
  async searchByGenre(genres, options = {}) {
    if (typeof genres === "string" && !genres.includes(",") && Object.keys(options).length === 0) {
      return this.getByGenre(genres, 1);
    }
    return this.searchAdvanced({ genres, ...options }, options.page || 1);
  }

  /**
   * Alias untuk searchAdvanced
   */
  async filter(filters = {}, page = 1) {
    return this.searchAdvanced(filters, page);
  }

  /**
   * Pencarian anime di Animasu.
   * Fleksibel dan polymorphic:
   * 1. Jika query berupa string: pencarian kata kunci teks via /?s={query} atau format 'genre:{nama}'
   * 2. Jika query berupa object: filter multi-genre dan parameter via /pencarian/
   * 
   * @param {string|object} queryOrOptions - Kata kunci string atau filter object
   * @param {number} [page=1] - Nomor halaman
   */
  async search(queryOrOptions, page = 1) {
    if (!queryOrOptions) return { success: false, error: "Query atau filter wajib diberikan" };

    if (typeof queryOrOptions === "object") {
      if (queryOrOptions.genre || queryOrOptions.genres) {
        return this.searchAdvanced(queryOrOptions, queryOrOptions.page || page);
      }
      if (queryOrOptions.query || queryOrOptions.s) {
        return this.search(queryOrOptions.query || queryOrOptions.s, queryOrOptions.page || page);
      }
      return this.searchAdvanced(queryOrOptions, queryOrOptions.page || page);
    }

    const query = String(queryOrOptions).trim();
    if (query.startsWith("genre:")) {
      return this.getByGenre(query.replace("genre:", "").trim(), page);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const searchUrl = pageNum > 1
      ? `${this.activeDomain}/page/${pageNum}/?s=${encodeURIComponent(query)}`
      : `${this.activeDomain}/?s=${encodeURIComponent(query)}`;

    const { html, statusCode, error, finalUrl } = await this.fetchHTML(searchUrl);

    if (error || !html) {
      return { success: false, status_code: statusCode, error };
    }

    const $ = cheerio.load(html);
    const results = [];

    $(".listupd article, .animepost, .bsx").each((_, el) => {
      const a = $(el).find("a").first();
      const href = a.attr("href");
      if (!href) return;

      const title = $(el).find(".tt, .title, h2, h4").text().trim() || a.attr("title") || "";
      const type = $(el).find(".type, .typez").text().trim() || null;
      const status = $(el).find(".status, .epx").text().trim() || null;
      const rawThumb = $(el).find("img").attr("src") || $(el).find("img").attr("data-src") || null;
      let cleanThumb = rawThumb;
      if (rawThumb && rawThumb.includes("wp.com/")) {
        cleanThumb = rawThumb.replace(/^https?:\/\/i\d+\.wp\.com\//i, "https://");
      }
      const score = $(el).find(".rating, .score").text().trim() || null;

      results.push({
        title,
        url: this.normalizeTargetUrl(href),
        type,
        status,
        score,
        thumbnail: rawThumb,
        thumbnail_clean: cleanThumb,
      });
    });

    return {
      success: true,
      status_code: statusCode,
      total_results: results.length,
      page: pageNum,
      data: results,
      url: finalUrl,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mengambil anime terbaru yang sedang tayang / update episode
   */
  async getLatest(page = 1) {
    const pageUrl = page > 1 ? `${this.activeDomain}/?page=${page}` : `${this.activeDomain}/`;
    const { html, statusCode, error, finalUrl } = await this.fetchHTML(pageUrl);

    if (error || !html) {
      return { success: false, status_code: statusCode, error };
    }

    const $ = cheerio.load(html);
    const items = [];

    $(".listupd article, .animepost, .bsx").each((_, el) => {
      const a = $(el).find("a").first();
      const href = a.attr("href");
      if (!href) return;

      const title = $(el).find(".tt, .title, h2, h4").text().trim() || a.attr("title") || "";
      const type = $(el).find(".type, .typez").text().trim() || null;
      const episode = $(el).find(".epx, .status").text().trim() || null;
      const thumbnail = $(el).find("img").attr("src") || null;

      items.push({
        title,
        url: this.normalizeTargetUrl(href),
        type,
        episode,
        thumbnail,
      });
    });

    return {
      success: true,
      status_code: statusCode,
      page,
      total_items: items.length,
      data: items,
      url: finalUrl,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mengambil data kumpulan franchise / serial / OVA / movie terkait
   */
  async getFranchise(franchiseUrlOrSlug) {
    const targetUrl = this.normalizeTargetUrl(franchiseUrlOrSlug);
    const { html, statusCode, error, finalUrl } = await this.fetchHTML(targetUrl);

    if (error || !html) {
      return { success: false, status_code: statusCode, error };
    }

    const $ = cheerio.load(html);
    const title = $("h1").text().trim();
    const relatedList = [];

    $(".listupd article, .animepost, .bsx").each((_, el) => {
      const a = $(el).find("a").first();
      const href = a.attr("href");
      if (!href) return;

      const itemTitle = $(el).find(".tt, .title").text().trim() || a.attr("title");
      const type = $(el).find(".type, .typez").text().trim();
      const date = $(el).find(".epx, .status").text().trim();
      const thumbnail = $(el).find("img").attr("src");

      relatedList.push({
        title: itemTitle,
        url: this.normalizeTargetUrl(href),
        type,
        release_info: date,
        thumbnail,
      });
    });

    return {
      success: true,
      status_code: statusCode,
      franchise_title: title,
      url: finalUrl,
      total_related: relatedList.length,
      data: relatedList,
      timestamp: new Date().toISOString(),
    };
  }
}

const defaultScraper = new AnimasuScraper();

export default {
  AnimasuScraper,
  DEFAULT_ANIMASU_DOMAINS,
  extract: (urlOrSlug, options) => defaultScraper.extract(urlOrSlug, options),
  getEpisode: (episodeUrlOrSlug) => defaultScraper.getEpisode(episodeUrlOrSlug),
  search: (queryOrOptions, page) => defaultScraper.search(queryOrOptions, page),
  getGenres: () => defaultScraper.getGenres(),
  getByGenre: (genreSlugOrUrl, page) => defaultScraper.getByGenre(genreSlugOrUrl, page),
  searchByGenre: (genres, options) => defaultScraper.searchByGenre(genres, options),
  searchAdvanced: (filters, page) => defaultScraper.searchAdvanced(filters, page),
  filter: (filters, page) => defaultScraper.filter(filters, page),
  getLatest: (page) => defaultScraper.getLatest(page),
  getFranchise: (franchiseUrlOrSlug) => defaultScraper.getFranchise(franchiseUrlOrSlug),
  setBaseUrl: (url) => defaultScraper.setBaseUrl(url),
  getBaseUrl: () => defaultScraper.getBaseUrl(),
  resolveActiveDomain: () => defaultScraper.resolveActiveDomain(),
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const arg = process.argv[2] || "https://animasu.love/anime/kusuriya-no-hitorigoto-s3/";
  console.log(`[AnimasuScraper] Menjalankan extraction untuk: ${arg}`);

  (async () => {
    try {
      let result;
      if (arg.includes("/nonton-")) {
        result = await defaultScraper.getEpisode(arg);
      } else if (arg.startsWith("search:")) {
        result = await defaultScraper.search(arg.replace("search:", ""));
      } else if (arg.startsWith("genre:")) {
        result = await defaultScraper.getByGenre(arg.replace("genre:", ""));
      } else if (arg === "genres" || arg === "genre-list") {
        result = await defaultScraper.getGenres();
      } else if (arg.startsWith("filter:")) {
        const raw = arg.replace("filter:", "").split(",");
        result = await defaultScraper.searchAdvanced({ genres: raw });
      } else {
        result = await defaultScraper.extract(arg, { fetchStreams: true, streamLimit: 1 });
      }
      console.log(JSON.stringify(result, null, 2));

      if (result && result.data && result.data.title) {
        console.log("\n" + "=".repeat(60));
        console.log("            RINGKASAN DATA ANIME LENGKAP");
        console.log("=".repeat(60));
        console.log(`Judul       : ${result.data.title}`);
        console.log(`Tipe        : ${result.data.type}`);
        console.log(`Skor        : ${result.data.score ?? result.data.raw_score ?? "N/A"}`);
        console.log(`Status      : ${result.data.details?.status || "N/A"}`);
        console.log(`Pengarang   : ${result.data.details?.author?.name || result.data.details?.author || "N/A"}`);
        console.log(`Studio      : ${result.data.details?.studio?.name || "N/A"}`);
        console.log(`Total Ep    : ${result.data.total_episodes}`);
        console.log(`Trailer YT  : ${result.data.trailer?.watch_url || "Tidak ada"}`);
        console.log("-".repeat(60));
        console.log(`Sinopsis / Deskripsi:\n${result.data.synopsis || "Tidak ada sinopsis."}`);
        console.log("=".repeat(60) + "\n");
      }
    } catch (err) {
      console.error("[AnimasuScraper] Terjadi error:", err);
    }
  })();
}
