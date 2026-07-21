import * as Linking from "expo-linking";

export function tokenFromUrl(url: string | null) {
  if (!url) return "";
  const parsed = Linking.parse(url);
  if (parsed.scheme === "taskbridge" && parsed.hostname === "visit") {
    const token = Array.isArray(parsed.path) ? "" : parsed.path || "";
    return token.replace(/^\/+/, "");
  }
  const match = url.match(/\/visit\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function initialToken() {
  const url = await Linking.getInitialURL();
  return tokenFromUrl(url);
}
