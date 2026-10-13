import axios from "axios";
import * as cheerio from "cheerio";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * In-memory Cookie Jar untuk mempertahankan sesi HTTP seperti net/http/cookiejar di Go.
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
 * Helper pembentuk objek dengan urutan kunci & omitempty persis 100% seperti struct Go.
 */
function makeEpisodeData({
  series_id,
  series_title,
  series_url,
  episode_number,
  episode_title,
  episode_url,
  thumbnail,
  prev_url,
  next_url,
  streams,
  downloads,
}) {
  const obj = {};
  if (series_id) obj.series_id = series_id;
  if (series_title) obj.series_title = series_title;
  if (series_url) obj.series_url = series_url;
  if (episode_number) obj.episode_number = episode_number;
  if (episode_title) obj.episode_title = episode_title;
  if (episode_url) obj.episode_url = episode_url;
  if (thumbnail) obj.thumbnail = thumbnail;
  if (prev_url) obj.prev_url = prev_url;
  if (next_url) obj.next_url = next_url;
  if (streams && streams.length > 0) obj.streams = streams;
  if (downloads && downloads.length > 0) obj.downloads = downloads;
  return obj;
}

function makeSeriesData({
  title,
  japanese_title,
  thumbnail,
  score,
  status,
  type,
  total_episodes,
  duration,
  release_date,
  studio,
  genres,
  synopsis,
  episodes,
}) {
  const obj = { title: title || "" };
  if (japanese_title) obj.japanese_title = japanese_title;
  if (thumbnail) obj.thumbnail = thumbnail;
  if (score) obj.score = score;
  if (status) obj.status = status;
  if (type) obj.type = type;
  if (total_episodes) obj.total_episodes = total_episodes;
  if (duration) obj.duration = duration;
  if (release_date) obj.release_date = release_date;
  if (studio) obj.studio = studio;
  if (genres && genres.length > 0) obj.genres = genres;
  if (synopsis) obj.synopsis = synopsis;
  if (episodes && episodes.length > 0) obj.episodes = episodes;
  return obj;
}

function makeStreamServerItem({ server_name, post_id, nume, embed_url, direct_stream }) {
  const obj = { server_name };
  if (post_id) obj.post_id = post_id;
  if (nume) obj.nume = nume;
  if (embed_url) obj.embed_url = embed_url;
  if (direct_stream) obj.direct_stream = direct_stream;
  return obj;
}

function makeDownloadItem({ server_name, out_url, direct_url, quality }) {
  const obj = { server_name, out_url };
  if (direct_url) obj.direct_url = direct_url;
  if (quality) obj.quality = quality;
  return obj;
}

function makeReleaseItem({ title, url, episode_number, thumbnail, score, status, type, slug, genres, release_date }) {
  const obj = { title, url };
  if (slug) obj.slug = slug;
  if (episode_number) obj.episode_number = episode_number;
  if (thumbnail) obj.thumbnail = thumbnail;
  if (score) obj.score = score;
  if (status) obj.status = status;
  if (type) obj.type = type;
  if (genres && genres.length > 0) obj.genres = genres;
  if (release_date) obj.release_date = release_date;
  return obj;
}

function makeExtractionResult({ success, status_code, data, error, timestamp }) {
  const obj = { success };
  if (status_code !== undefined && status_code !== 0) obj.status_code = status_code;
  if (data !== undefined) obj.data = data;
  if (error !== undefined && error !== null) obj.error = error;
  obj.timestamp = timestamp;
  return obj;
}

/**
 * AnimeScraper (ScraperEngine):
 * Mengonversi 100% logic ScraperEngine Golang ke ES Class JavaScript yang modular,
 * siap di-import di project backend lain, bot WhatsApp, Next.js / Express API.
 */
export class AnimeScraper {
  /**
   * @param {number|object} [options] - timeout ms (number) atau objek konfigurasi { timeout?: number }
   */
  constructor(options = {}) {
    const timeoutMs =
      typeof options === "number" ? options : options.timeout || 25000;

    this.timeout = timeoutMs;
    this.jar = new CookieJar();

    this.axiosInstance = axios.create({
      timeout: this.timeout,
      maxRedirects: 5,
      validateStatus: () => true, // Mengikuti perilaku http.Client di Go
    });

    // Request interceptor: Sisipkan cookie jar otomatis
    this.axiosInstance.interceptors.request.use((config) => {
      const cookieHeader = this.jar.getCookieHeader();
      if (cookieHeader) {
        config.headers["Cookie"] = cookieHeader;
      }
      return config;
    });

    // Response interceptor: Simpan cookie sesi otomatis
    this.axiosInstance.interceptors.response.use((response) => {
      this.jar.setCookiesFromHeaders(response.headers);
      return response;
    });
  }

  /**
   * Helper header HTTP persis seperti applyHeaders di Go.
   */
  applyHeaders(customHeaders = {}, referer = "") {
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
      ...customHeaders,
    };

    if (referer) {
      headers["Referer"] = referer;
    }

    return headers;
  }

  /**
   * Mengambil konten HTML dari URL target.
   */
  async fetchHTML(targetURL, referer = "") {
    try {
      const resp = await this.axiosInstance.get(targetURL, {
        headers: this.applyHeaders({}, referer),
        responseType: "text",
      });

      return {
        htmlContent: typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data),
        statusCode: resp.status,
        error: null,
      };
    } catch (err) {
      const status = err.response ? err.response.status : 0;
      return {
        htmlContent: "",
        statusCode: status,
        error: err,
      };
    }
  }

  /**
   * Mendekode script inline base64 (kotakajax, episodeToTrack).
   */
  parseBase64Scripts(htmlContent) {
    const results = {};
    const re = /data:text\/javascript;base64,([A-Za-z0-9+/=]+)/g;
    let match;
    while ((match = re.exec(htmlContent)) !== null) {
      if (match[1]) {
        try {
          const decoded = Buffer.from(match[1], "base64").toString("utf-8");
          if (decoded.includes("kotakajax")) {
            results["kotakajax"] = decoded;
          }
          if (decoded.includes("episodeToTrack")) {
            results["episodeToTrack"] = decoded;
          }
        } catch {
          // ignore error
        }
      }
    }
    return results;
  }

  /**
   * Menembus AJAX admin WordPress untuk mendapatkan URL embed iframe.
   */
  async resolvePlayerAjax(apiURL, postID, nume, serverName, nonce, pageURL) {
    try {
      const params = new URLSearchParams();
      params.append("action", "player_ajax");
      params.append("post", postID);
      params.append("nume", nume);
      params.append("serverName", serverName);
      params.append("nonce", nonce);
      params.append("did", `k_${Date.now().toString(16)}${process.pid}`);

      const headers = this.applyHeaders(
        {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          Origin: "https://s13.nontonanimeid.boats",
        },
        pageURL
      );

      const resp = await this.axiosInstance.post(apiURL, params.toString(), {
        headers,
        responseType: "text",
      });

      const bodyStr = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);
      const reIframe = /src=["']([^"']+)["']/;
      const match = reIframe.exec(bodyStr);
      if (match && match[1]) {
        return match[1];
      }
      return "";
    } catch {
      return "";
    }
  }

  /**
   * Algoritma dekripsi XOR cipher untuk mengekstrak direct stream .m3u8/.mp4 dari JWPlayer embed.
   */
  async decryptEmbedM3U8(embedURL, referer) {
    const { htmlContent, statusCode, error } = await this.fetchHTML(embedURL, referer);
    if (error || statusCode >= 400) {
      return "";
    }

    let prefix = "_w['at'+'ob'](";
    let start = htmlContent.indexOf(prefix);
    if (start === -1) {
      prefix = '_w["at"+"ob"](';
      start = htmlContent.indexOf(prefix);
    }
    if (start === -1) {
      return "";
    }

    const payloadStart = start + prefix.length;
    const endMarker = ");var ";
    const markerIdx = htmlContent.indexOf(endMarker, payloadStart);
    if (markerIdx === -1) {
      return "";
    }

    let rawArg = htmlContent.substring(payloadStart, markerIdx).trim();
    if (
      (rawArg.startsWith("'") && rawArg.endsWith("'")) ||
      (rawArg.startsWith('"') && rawArg.endsWith('"'))
    ) {
      rawArg = rawArg.substring(1, rawArg.length - 1);
    }

    const cleanB64 = rawArg.replace(/['"]\s*\+\s*['"]/g, "");

    const reArray = /var s=['"]([0-9,]+)['"]/;
    const arrayMatch = reArray.exec(htmlContent);
    if (!arrayMatch || arrayMatch.length < 2) {
      return "";
    }

    const reCalc = /parseInt\(s\[j\],10\)\s*-\s*(\d+)\s*\*\s*\(j\s*\+\s*(\d+)\)/;
    const calcMatch = reCalc.exec(htmlContent);
    if (!calcMatch || calcMatch.length < 3) {
      return "";
    }

    const multiplier = parseInt(calcMatch[1], 10);
    const offset = parseInt(calcMatch[2], 10);

    const sTokens = arrayMatch[1].split(",");
    const key = new Uint8Array(sTokens.length);
    for (let j = 0; j < sTokens.length; j++) {
      const val = parseInt(sTokens[j], 10);
      const computed = (val - multiplier * (j + offset)) & 255;
      key[j] = computed;
    }

    let cipherBytes;
    try {
      cipherBytes = Buffer.from(cleanB64, "base64");
    } catch {
      return "";
    }

    if (cipherBytes.length === 0 || key.length === 0) {
      return "";
    }

    const decrypted = Buffer.alloc(cipherBytes.length);
    for (let i = 0; i < cipherBytes.length; i++) {
      decrypted[i] = cipherBytes[i] ^ key[i % key.length];
    }

    const decryptedCode = decrypted.toString("utf-8");

    const reFile = /"file"\s*:\s*"(https:\/\/[^"]+)"/g;
    let fileMatch;
    while ((fileMatch = reFile.exec(decryptedCode)) !== null) {
      if (fileMatch[1] && !fileMatch[1].includes("blank.mp4")) {
        return fileMatch[1].replace(/\\\//g, "/");
      }
    }

    const reM3U8 = /https:\/\/[^"'\s\\]+\.m3u8/;
    const matchM3U8 = reM3U8.exec(decryptedCode);
    if (matchM3U8 && matchM3U8[0] && !matchM3U8[0].includes("blank.mp4")) {
      return matchM3U8[0].replace(/\\\//g, "/");
    }

    return "";
  }

  /**
   * Menyelesaikan challenge security token untuk link mirror download.
   */
  async resolveDownloadMirror(outURL, referer) {
    const { htmlContent, statusCode, error } = await this.fetchHTML(outURL, referer);
    if (error || statusCode >= 400) {
      return ["", ""];
    }

    const reDL = /window\.DL\s*=\s*\{([^}]+)\};/;
    const dlMatch = reDL.exec(htmlContent);
    if (!dlMatch || dlMatch.length < 2) {
      return ["", ""];
    }

    const dlBlock = "{" + dlMatch[1] + "}";
    const isBlogger = dlBlock.includes("isBlogger: true");

    const reEncrypted = /encrypted:\s*["']([^"']+)["']/;
    const reTitle = /title:\s*["']([^"']+)["']/;
    const reGate = /gate:\s*([0-9]+)/;
    const reSig = /sig:\s*["']([^"']+)["']/;

    const encMatch = reEncrypted.exec(dlBlock);
    const titleMatch = reTitle.exec(dlBlock);
    const gateMatch = reGate.exec(dlBlock);
    const sigMatch = reSig.exec(dlBlock);

    if (!encMatch || encMatch.length < 2) {
      return ["", ""];
    }

    const encryptedVal = encMatch[1];
    const titleVal = titleMatch && titleMatch.length > 1 ? titleMatch[1] : "";
    const gateVal = gateMatch && gateMatch.length > 1 ? gateMatch[1] : "";
    const sigVal = sigMatch && sigMatch.length > 1 ? sigMatch[1] : "";

    let parsedOutURL;
    try {
      parsedOutURL = new URL(outURL);
    } catch {
      return ["", ""];
    }

    const hostOrigin = `${parsedOutURL.protocol}//${parsedOutURL.host}`;

    let targetRequestURL = "";
    let tokenPayloadMap = {};

    if (isBlogger) {
      const dlReqURL = `${hostOrigin}/video/get-download.php?mode=lokal&vid=${encodeURIComponent(
        encryptedVal
      )}&title=${encodeURIComponent(titleVal)}&dl=yes&json=true`;
      targetRequestURL = dlReqURL;
      tokenPayloadMap = { url: dlReqURL };
    } else {
      targetRequestURL = encryptedVal;
      tokenPayloadMap = { url: encryptedVal };
    }

    const tokenEndpoint = `${hostOrigin}/video/get-token.php`;
    const tokenHeaders = this.applyHeaders(
      {
        "Content-Type": "application/json",
        "X-Fingerprint": "dummy-fingerprint",
        "X-DL-Gate": gateVal,
        "X-DL-Sig": sigVal,
      },
      outURL
    );

    let tokenData;
    try {
      const tokenResp = await this.axiosInstance.post(
        tokenEndpoint,
        tokenPayloadMap,
        { headers: tokenHeaders }
      );
      tokenData = tokenResp.data;
    } catch {
      return ["", ""];
    }

    const token = tokenData?.token || "";
    const timestamp = String(tokenData?.timestamp || "");
    const challenge = tokenData?.challenge || "";

    if (!token) {
      return ["", ""];
    }

    let dlEndpoint = `${hostOrigin}/video/get-download.php`;
    if (isBlogger) {
      dlEndpoint = targetRequestURL;
    }

    const dlPayloadMap = {
      url: targetRequestURL,
      challenge: challenge,
    };

    const dlHeaders = this.applyHeaders(
      {
        "Content-Type": "application/json",
        "X-Security-Token": token,
        "X-Timestamp": timestamp,
        "X-Fingerprint": "dummy-fingerprint",
        "X-Challenge": challenge,
      },
      outURL
    );

    let dlData;
    try {
      const dlResp = await this.axiosInstance.post(dlEndpoint, dlPayloadMap, {
        headers: dlHeaders,
      });
      dlData = dlResp.data;
    } catch {
      return ["", ""];
    }

    let resolvedPath = "";
    let quality = "";

    if (isBlogger) {
      const qList = ["1080p", "HD", "720p", "480p", "360p"];
      for (const q of qList) {
        const linkArr = dlData?.links?.[q];
        if (Array.isArray(linkArr) && linkArr.length > 0) {
          resolvedPath = linkArr[0]?.url || "";
          quality = q;
          break;
        }
      }
    } else {
      const downloadLinks = dlData?.links?.download;
      if (Array.isArray(downloadLinks) && downloadLinks.length > 0) {
        resolvedPath = downloadLinks[0]?.url || "";
      }
    }

    if (!resolvedPath) {
      return ["", ""];
    }

    let finalTargetURL = resolvedPath;
    if (resolvedPath.startsWith("/")) {
      finalTargetURL = hostOrigin + resolvedPath;
    }

    try {
      // no-follow redirect check
      const redirResp = await axios.get(finalTargetURL, {
        headers: this.applyHeaders({}, outURL),
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        timeout: 10000,
      });

      const loc = redirResp.headers["location"];
      if (loc) {
        return [loc, quality];
      }
    } catch (err) {
      if (err.response && err.response.headers && err.response.headers["location"]) {
        return [err.response.headers["location"], quality];
      }
    }

    return [finalTargetURL, quality];
  }

  /**
   * Ekstraksi halaman episode (-episode-).
   */
  async extractEpisodePage(pageURL, htmlContent, startTime, statusCode) {
    const $ = cheerio.load(htmlContent);

    const jsMap = this.parseBase64Scripts(htmlContent);
    const trackRaw = jsMap["episodeToTrack"] || "";
    const ajaxRaw = jsMap["kotakajax"] || "";

    let seriesID = "";
    let seriesTitle = "";
    let seriesURL = "";
    let episodeNumber = "";
    let thumbnail = "";

    if (trackRaw) {
      const eqIdx = trackRaw.indexOf("var episodeToTrack=");
      if (eqIdx !== -1) {
        let jsonSegment = trackRaw.substring(eqIdx + "var episodeToTrack=".length).trim();
        if (jsonSegment.endsWith(";")) {
          jsonSegment = jsonSegment.substring(0, jsonSegment.length - 1);
        }
        try {
          const parsed = JSON.parse(jsonSegment);
          if (parsed.seriesId) seriesID = String(parsed.seriesId);
          if (parsed.seriesTitle) seriesTitle = String(parsed.seriesTitle);
          if (parsed.seriesUrl) seriesURL = String(parsed.seriesUrl);
          if (parsed.episodeNumber) episodeNumber = String(parsed.episodeNumber);
          if (parsed.poster) thumbnail = String(parsed.poster);
        } catch {
          // ignore
        }
      }
    }

    let episodeTitle = $("h1.entry-title, .name, title").first().text().trim();
    if (episodeTitle) {
      episodeTitle = episodeTitle
        .replace(/\s+Sub\s*Indo.*$/i, "")
        .replace(/\s*-\s*Nonton\s*Anime.*$/i, "")
        .trim();
    }
    if (!thumbnail) {
      thumbnail =
        $(".featuredimgs img, meta[property='og:image']").first().attr("src") ||
        $("meta[property='og:image']").attr("content") ||
        "";
    }

    const prevURL =
      $(".naveps .nvs a[title*='Prev'], .naveps .nvs a:contains('Prev')").first().attr("href") || "";
    const nextURL =
      $(".naveps .nvs a[title*='Next'], .naveps .nvs a:contains('Next')").first().attr("href") || "";

    let adminAjaxURL = "https://s13.nontonanimeid.boats/wp-admin/admin-ajax.php";
    let nonceVal = "";

    if (ajaxRaw) {
      const eqIdx = ajaxRaw.indexOf("var kotakajax=");
      if (eqIdx !== -1) {
        let jsonSegment = ajaxRaw.substring(eqIdx + "var kotakajax=".length).trim();
        if (jsonSegment.endsWith(";")) {
          jsonSegment = jsonSegment.substring(0, jsonSegment.length - 1);
        }
        try {
          const parsed = JSON.parse(jsonSegment);
          if (parsed.url) adminAjaxURL = parsed.url;
          if (parsed.nonce) nonceVal = parsed.nonce;
        } catch {
          // ignore
        }
      }
    }

    const streams = [];
    const playerOptionEls = $(".kotak_player_option").toArray();
    for (const el of playerOptionEls) {
      const sel = $(el);
      const postID = sel.attr("data-post") || "";
      const serverName = sel.attr("data-type") || "";
      const nume = sel.attr("data-nume") || "";
      let label = sel.text().trim();
      if (!label) {
        label = serverName;
      }

      let embedURL = "";
      let directM3U8 = "";

      if (nonceVal && postID && nume) {
        embedURL = await this.resolvePlayerAjax(
          adminAjaxURL,
          postID,
          nume,
          serverName,
          nonceVal,
          pageURL
        );
        if (embedURL.includes("kotakanimeid.link")) {
          directM3U8 = await this.decryptEmbedM3U8(embedURL, pageURL);
        }
      }

      if (embedURL && embedURL.startsWith("//")) {
        embedURL = "https:" + embedURL;
      }

      streams.push(
        makeStreamServerItem({
          server_name: label,
          post_id: postID,
          nume: nume,
          embed_url: embedURL,
          direct_stream: directM3U8,
        })
      );
    }

    if (streams.length === 0 || !streams.some((s) => s.embed_url)) {
      let defaultIframe =
        $(".responsive-embed-operations iframe, #pembed iframe, .player iframe, iframe").first().attr("src") || "";
      if (defaultIframe && defaultIframe.startsWith("//")) {
        defaultIframe = "https:" + defaultIframe;
      }
      if (defaultIframe) {
        streams.unshift(
          makeStreamServerItem({
            server_name: "Default Server",
            post_id: "",
            nume: "1",
            embed_url: defaultIframe,
            direct_stream: "",
          })
        );
      }
    }

    const downloads = [];
    const downloadLinks = $("#download_area .listlink a, #arealinker .listlink a").toArray();
    for (const el of downloadLinks) {
      const sel = $(el);
      const outHref = sel.attr("href") || "";
      if (!outHref || !outHref.includes("/out/")) {
        continue;
      }

      const serverLabel = sel.text().trim();
      const [directURL, qual] = await this.resolveDownloadMirror(outHref, pageURL);

      downloads.push(
        makeDownloadItem({
          server_name: serverLabel,
          out_url: outHref,
          direct_url: directURL,
          quality: qual,
        })
      );
    }

    let seriesSlug = "";
    if (seriesURL) {
      const match = /\/anime\/([^\/]+)/.exec(seriesURL);
      if (match && match[1]) seriesSlug = match[1];
    }
    if (!seriesSlug) {
      const match = /\/([^\/]+)-episode-\d+/.exec(pageURL);
      if (match && match[1]) seriesSlug = match[1];
    }

    // Bangun data dengan urutan persis seperti struct EpisodeData di Go
    const data = makeEpisodeData({
      series_id: seriesID,
      series_title: seriesTitle,
      series_url: seriesURL,
      series_slug: seriesSlug,
      episode_number: episodeNumber,
      episode_title: episodeTitle,
      episode_url: pageURL,
      thumbnail: thumbnail,
      prev_url: prevURL,
      next_url: nextURL,
      streams: streams,
      downloads: downloads,
    });
    if (seriesSlug) data.series_slug = seriesSlug;

    return makeExtractionResult({
      success: true,
      status_code: statusCode,
      data,
      timestamp: startTime,
    });
  }

  /**
   * Ekstraksi halaman series (/anime/).
   */
  extractSeriesPage(pageURL, htmlContent, startTime, statusCode) {
    const $ = cheerio.load(htmlContent);

    const rawTitle = $(".entry-title, .title.less, h1").first().text().trim();
    const title =
      rawTitle
        .replace(/^Nonton\s+/i, "")
        .replace(/\s+Sub\s*Indo.*$/i, "")
        .replace(/\s*-\s*Nonton\s*Anime.*$/i, "")
        .trim() || rawTitle;

    let thumbnail = "";
    $("meta[property='og:image']").each((_, el) => {
      if (!thumbnail) {
        thumbnail = $(el).attr("content") || "";
      }
    });
    if (!thumbnail) {
      thumbnail = $(".featuredimgs img, .poster img, img.wp-post-image").first().attr("src") || "";
    }

    let japaneseTitle = "";
    let score = "";
    let status = "";
    let type = "";
    let totalEpisodes = "";
    let duration = "";
    let studio = "";
    let releaseDate = "";

    const cleanField = (rawText, pattern) => {
      let val = rawText.replace(pattern, "");
      return val.replace(/^[\s:]+/, "").trim();
    };

    // 1. Check quick info line
    const quickInfo = $(".anime-card__quick-info, .spe, .listinfo").text().trim().replace(/\s+/g, " ");
    if (quickInfo) {
      if (quickInfo.toLowerCase().includes("finished")) status = "Completed";
      else if (quickInfo.toLowerCase().includes("currently") || quickInfo.toLowerCase().includes("airing")) status = "Ongoing";

      const epMatch = /(\d+)\s+Episodes?/i.exec(quickInfo);
      if (epMatch) totalEpisodes = epMatch[1];

      const durMatch = /(\d+\s*(?:hr|min)[^\cdot·]*)/i.exec(quickInfo);
      if (durMatch) duration = durMatch[1].trim();

      const yearMatch = /(?:Winter|Spring|Summer|Fall)\s+\d{4}|\b20\d{2}\b/i.exec(quickInfo);
      if (yearMatch) releaseDate = yearMatch[0];
    }

    // 2. Scan info elements and LI
    $(".content-info, .infokotak, .info-content, .tableinfo tr, li, .listinfo li, .spe span").each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, " ");
      if (text.includes("Japanese") || text.includes("Judul")) {
        if (!japaneseTitle) japaneseTitle = cleanField(text, /Japanese|Judul/i);
      }
      if (text.includes("Skor") || text.includes("Score")) {
        if (!score) score = cleanField(text, /Skor|Score/i);
      }
      if (text.includes("Status")) {
        if (!status) status = cleanField(text, /Status/i);
      }
      if (text.includes("Tipe") || text.includes("Type")) {
        if (!type) type = cleanField(text, /Tipe|Type/i);
      }
      if (text.includes("Total Episode") || text.includes("Episodes")) {
        if (!totalEpisodes) {
          const m = /(\d+)/.exec(text);
          if (m) totalEpisodes = m[1];
        }
      }
      if (text.includes("Durasi") || text.includes("Duration")) {
        if (!duration) duration = cleanField(text, /Durasi|Duration/i);
      }
      if (text.includes("Studio")) {
        if (!studio) studio = cleanField(text, /Studios?/i);
      }
      if (text.includes("Rilis") || text.includes("Released") || text.includes("Aired")) {
        if (!releaseDate) releaseDate = cleanField(text, /Rilis|Released|Aired/i);
      }
    });

    if (!score) {
      score = $(".as-rating, .kotakscore, .score, span.rating").first().text().replace("⭐", "").trim();
    }
    if (!type) {
      // Look inside article info first to avoid matching sidebar recommendations
      type = $("article .as-type, article .types, .anime-card__main .types").first().text().replace("📺", "").trim();
    }

    const lowerTitle = title.toLowerCase();
    const lowerURL = pageURL.toLowerCase();
    const lowerQuick = quickInfo.toLowerCase();
    const totalEpNum = parseInt(totalEpisodes, 10);

    let isMovie = false;
    if (
      lowerTitle.includes("movie") ||
      lowerTitle.includes("film") ||
      lowerURL.includes("-movie") ||
      lowerQuick.includes("movie") ||
      (duration.includes("hr") && (!totalEpNum || totalEpNum === 1))
    ) {
      if (totalEpNum && totalEpNum > 1 && !lowerTitle.includes("movie")) {
        isMovie = false;
      } else {
        isMovie = true;
      }
    }

    if (status) {
      const lowerStatus = status.toLowerCase();
      if (
        lowerStatus.includes("finish") ||
        lowerStatus.includes("complete") ||
        lowerStatus.includes("tamat") ||
        lowerStatus.includes("selesai")
      ) {
        status = "Completed";
      } else if (
        lowerStatus.includes("air") ||
        lowerStatus.includes("ongoing") ||
        lowerStatus.includes("berjalan")
      ) {
        status = "Ongoing";
      }
    } else {
      if (isMovie) {
        status = "Completed";
      } else if (lowerQuick.includes("finished")) {
        status = "Completed";
      } else if (lowerQuick.includes("currently") || lowerQuick.includes("airing")) {
        status = "Ongoing";
      }
    }

    if (isMovie) {
      type = "Movie";
      if (!totalEpisodes || totalEpisodes === "0") totalEpisodes = "1";
      if (!status || status === "Ongoing") status = "Completed";
    } else {
      if (!type || type.toLowerCase().includes("movie")) {
        type = "TV";
      }
    }

    const genres = [];
    $(".tagline, .genre-info a, a[href*='/genres/']").each((_, el) => {
      const genre = $(el).text().trim();
      if (genre && !genre.includes("Lihat") && !genres.includes(genre)) {
        genres.push(genre);
      }
    });

    const synopsis = $(".entry-content.seriesdesc, .entry-content p, .desc p").text().trim();

    const episodes = [];
    const seenEps = new Set();

    if (isMovie) {
      // Find movie stream link
      let movieWatchLink = $("a:contains('Pertama'), a.first-episode, .meta-episode-item a, a.episode-item, a[href$='-movie/']").first().attr("href") || "";
      if (!movieWatchLink || movieWatchLink === pageURL || movieWatchLink.includes("/anime/")) {
        movieWatchLink = pageURL.replace("/anime/", "/");
      }
      episodes.push({
        number: "1",
        title: "Full Movie",
        url: movieWatchLink,
      });
    } else {
      // Extract all episode links from page
      $("a.episode-item, .episodelist a, .series-chapterlist a, .meta-episode-item a, a[href*='-episode-']").each((_, el) => {
        let anchor = $(el);
        const link = anchor.attr("href") || "";
        if (link && link.includes("-episode-") && !link.includes("/anime/") && !seenEps.has(link)) {
          seenEps.add(link);
          let epTitle = anchor.text().trim().replace(/\s+/g, " ");
          epTitle = epTitle.replace(/^(Pertama|Terakhir)\s+/i, "").replace(/\[Tamat\]/i, "").trim();
          let epNum = "";
          const epMatches = /episode-(\d+)/.exec(link);
          if (epMatches && epMatches[1]) {
            epNum = epMatches[1];
          }
          episodes.push({
            number: epNum || String(episodes.length + 1),
            title: epTitle || `Episode ${epNum || episodes.length + 1}`,
            url: link,
          });
        }
      });

      // Sort episodes ascending by number if numeric
      episodes.sort((a, b) => {
        const numA = parseInt(a.number, 10);
        const numB = parseInt(b.number, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return 0;
      });

      // Detect total episodes and fill in sequence if incomplete
      let maxFound = episodes.length > 0 ? Math.max(...episodes.map((e) => parseInt(e.number, 10) || 0)) : 0;
      let totalNum = parseInt(totalEpisodes, 10);
      if (isNaN(totalNum) || totalNum < maxFound) {
        totalNum = maxFound;
        if (totalNum > 0) totalEpisodes = String(totalNum);
      }

      if (totalNum > episodes.length && episodes.length > 0) {
        const sample = episodes[0];
        const patternMatch = /^(.*?)-episode-\d+\/?$/.exec(sample.url);
        if (patternMatch && patternMatch[1]) {
          const basePrefix = patternMatch[1];
          const map = new Map(episodes.map((e) => [parseInt(e.number, 10), e]));
          episodes.length = 0;
          for (let n = 1; n <= totalNum; n++) {
            if (map.has(n)) {
              episodes.push(map.get(n));
            } else {
              episodes.push({
                number: String(n),
                title: `Episode ${n}`,
                url: `${basePrefix}-episode-${n}/`,
              });
            }
          }
        }
      }
    }

    let slug = "";
    const slugMatch = /\/anime\/([^\/]+)/.exec(pageURL);
    if (slugMatch && slugMatch[1]) {
      slug = slugMatch[1];
    }
    if (slugMatch && slugMatch[1]) {
      slug = slugMatch[1];
    }

    // Bangun data dengan urutan persis seperti struct SeriesData di Go
    const data = makeSeriesData({
      title,
      japanese_title: japaneseTitle,
      thumbnail,
      score,
      status,
      type,
      total_episodes: totalEpisodes,
      duration,
      release_date: releaseDate,
      studio,
      genres,
      synopsis,
      episodes,
    });
    if (slug) data.slug = slug;

    return makeExtractionResult({
      success: true,
      status_code: statusCode,
      data,
      timestamp: startTime,
    });
  }

  /**
   * Ekstraksi katalog rilis terbaru / search / genre.
   */
  extractCatalogPage(htmlContent, startTime, statusCode) {
    const $ = cheerio.load(htmlContent);
    const results = [];
    const seen = new Set();

    $("article.animeseries, .animeseries, .as-anime-card, .result .archive .as-anime-card, .result-item, .animpost, .film-item, article").each((_, el) => {
      const sel = $(el);
      let linkSel = sel.find("a").first();
      if (sel.is("a")) {
        linkSel = sel;
      }

      const targetHref = linkSel.attr("href") || "";
      let title = sel.find(".title, .as-anime-title, .as-card-title, h3, h2").first().text().trim();
      if (!title) {
        title = linkSel.attr("title") || sel.find("img").first().attr("alt") || "";
      }

      let thumb = sel.find("img").first().attr("src") || "";
      if (!thumb || thumb.includes("data:image")) {
        thumb =
          sel.find("img").first().attr("data-src") ||
          sel.find("img").first().attr("data-lazy-src") ||
          thumb;
      }

      const ep = sel.find(".types.episodes, .as-card-episode").first().text().trim();
      const score = sel.find(".kotakscore, .as-rating").first().text().trim().replace("⭐", "").trim();
      let status = sel.find(".types.status, .status").first().text().trim();
      let type = sel.find(".as-type").first().text().trim().replace("📺", "").trim();
      const season = sel.find(".as-season").first().text().trim().replace("📅", "").trim();

      const genres = [];
      sel.find(".as-genre-tag, .tagline a, .genre a").each((_, g) => {
        const txt = $(g).text().trim();
        if (txt && !genres.includes(txt)) genres.push(txt);
      });

      const isMovie =
        (type && type.toLowerCase().includes("movie")) ||
        title.toLowerCase().includes("movie") ||
        targetHref.includes("-movie");

      if (isMovie) {
        type = "Movie";
        if (!status || status === "Ongoing") status = "Completed";
      }

      if (status) {
        const lower = status.toLowerCase();
        if (
          lower.includes("finish") ||
          lower.includes("complete") ||
          lower.includes("tamat") ||
          lower.includes("selesai")
        ) {
          status = "Completed";
        } else if (
          lower.includes("air") ||
          lower.includes("ongoing") ||
          lower.includes("berjalan")
        ) {
          status = "Ongoing";
        } else if (
          lower.includes("upcom") ||
          lower === "uc"
        ) {
          status = "Upcoming";
        }
      } else if (season) {
        const yearM = /\b(19\d\d|20[0-2]\d)\b/.exec(season);
        if (yearM) {
          const parsedYear = parseInt(yearM[1], 10);
          if (parsedYear < 2026) {
            status = "Completed";
          } else if (parsedYear === 2026) {
            status = "Ongoing";
          } else {
            status = "Upcoming";
          }
        }
      }

      let slug = "";
      const animeMatch = /\/anime\/([^\/]+)/.exec(targetHref);
      if (animeMatch && animeMatch[1]) {
        slug = animeMatch[1];
      } else {
        const epMatch = /\/([^\/]+)-episode-\d+/.exec(targetHref);
        if (epMatch && epMatch[1]) {
          slug = epMatch[1];
        } else {
          const parts = targetHref.replace(/\/+$/, "").split("/");
          slug = parts[parts.length - 1] || "";
        }
      }

      if (targetHref && title && !seen.has(targetHref)) {
        seen.add(targetHref);
        results.push(
          makeReleaseItem({
            title,
            slug,
            url: targetHref,
            episode_number: ep || (isMovie ? "1" : ""),
            thumbnail: thumb,
            score: score || "",
            status: status || (isMovie ? "Completed" : ""),
            type: type || (isMovie ? "Movie" : "TV"),
            genres: genres,
            release_date: season || "",
          })
        );
      }
    });

    return makeExtractionResult({
      success: true,
      status_code: statusCode,
      data: results,
      timestamp: startTime,
    });
  }

  /**
   * Entrypoint utama, logic persis seperti ExtractData di anime.go.
   * @param {string} targetURL
   * @returns {Promise<object>}
   */
  async extractData(targetURL) {
    const startTime = Date.now();

    const { htmlContent, statusCode, error } = await this.fetchHTML(targetURL, "");
    if (error) {
      return makeExtractionResult({
        success: false,
        status_code: statusCode,
        error: {
          code: "NETWORK_REQUEST_FAILED",
          message: error.message,
        },
        timestamp: startTime,
      });
    }

    if (statusCode >= 400) {
      return makeExtractionResult({
        success: false,
        status_code: statusCode,
        error: {
          code: "HTTP_UPSTREAM_ERROR",
          message: `status: ${statusCode}`,
        },
        timestamp: startTime,
      });
    }

    const isWatchPage =
      targetURL.includes("-episode-") ||
      htmlContent.includes("kotak_player_option") ||
      htmlContent.includes("responsive-embed-operations") ||
      htmlContent.includes("episodeToTrack") ||
      htmlContent.includes("kotakajax");

    if (isWatchPage && !targetURL.includes("/anime/")) {
      return await this.extractEpisodePage(targetURL, htmlContent, startTime, statusCode);
    }

    if (targetURL.includes("/anime/")) {
      return this.extractSeriesPage(targetURL, htmlContent, startTime, statusCode);
    }

    return this.extractCatalogPage(htmlContent, startTime, statusCode);
  }

  /**
   * Static convenience method: Bisa dipanggil langsung tanpa 'new AnimeScraper()'.
   * Contoh: await AnimeScraper.extract("https://...")
   */
  static async extract(targetURL, options = {}) {
    const scraper = new AnimeScraper(options);
    return scraper.extractData(targetURL);
  }

  static BASE_URL = "https://s13.nontonanimeid.boats";

  static async getHome() {
    return AnimeScraper.extract(AnimeScraper.BASE_URL);
  }

  static async search(query) {
    if (!query) return { success: true, data: [] };
    return AnimeScraper.extract(`${AnimeScraper.BASE_URL}/?s=${encodeURIComponent(query)}`);
  }

  static async getAnimeDetail(slug) {
    if (!slug) return { success: false, error: "No slug provided" };
    const url = slug.startsWith("http") ? slug : `${AnimeScraper.BASE_URL}/anime/${slug}/`;
    return AnimeScraper.extract(url);
  }

  static async getEpisode(slug, episodeNum) {
    if (!slug) return { success: false, error: "No slug provided" };
    if (slug.startsWith("http")) {
      return AnimeScraper.extract(slug);
    }
    const ep = episodeNum || 1;
    if (slug.endsWith("-movie") || slug.includes("-movie-") || slug.includes("the-movie")) {
      return AnimeScraper.extract(`${AnimeScraper.BASE_URL}/${slug}/`);
    }
    const url = `${AnimeScraper.BASE_URL}/${slug}-episode-${ep}/`;
    return AnimeScraper.extract(url);
  }

  static async getByGenre(genre) {
    if (!genre) return { success: true, data: [] };
    const cleanGenre = genre.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return AnimeScraper.extract(`${AnimeScraper.BASE_URL}/genres/${cleanGenre}/`);
  }
}

// Alias untuk kompatibilitas nama Go maupun JS
export const ScraperEngine = AnimeScraper;
export default AnimeScraper;

// CLI Execution: Persis seperti main() di anime.go saat dijalankan lewat terminal
const isMain = () => {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return process.argv[1].endsWith("anime.js");
  }
};

if (isMain()) {
  const target = process.argv[2] || "https://s13.nontonanimeid.boats";
  AnimeScraper.extract(target)
    .then((result) => {
      // Escape HTML entities (& -> \u0026) persis seperti json.Marshal di Golang
      const jsonStr = JSON.stringify(result, null, "  ").replace(/&/g, "\\u0026");
      console.log(jsonStr);
    })
    .catch((err) => {
      console.error("engine_init_failed:", err);
      process.exit(1);
    });
}
