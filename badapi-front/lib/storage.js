const KEY_API = "badapi_api_key_active";
const KEY_API_LIST = "badapi_api_keys";
const KEY_SESSION = "badapi_session_token";
const KEY_JWT = "badapi_jwt";

export function getApiKey() {
  return typeof window === "undefined" ? "" : localStorage.getItem(KEY_API) || "";
}

export function setApiKey(value) {
  if (typeof window !== "undefined") localStorage.setItem(KEY_API, value || "");
}

export function getApiKeys() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY_API_LIST) || "[]");
  } catch {
    return [];
  }
}

export function saveApiKey(entry) {
  if (typeof window === "undefined") return [];
  const list = getApiKeys();
  const next = [entry, ...list.filter((item) => item.raw !== entry.raw)];
  localStorage.setItem(KEY_API_LIST, JSON.stringify(next));
  localStorage.setItem(KEY_API, entry.raw);
  return next;
}

export function removeApiKey(raw) {
  if (typeof window === "undefined") return [];
  const list = getApiKeys().filter((item) => item.raw !== raw);
  localStorage.setItem(KEY_API_LIST, JSON.stringify(list));
  if (localStorage.getItem(KEY_API) === raw) {
    localStorage.removeItem(KEY_API);
  }
  return list;
}

export function getSessionToken() {
  return typeof window === "undefined" ? "" : localStorage.getItem(KEY_SESSION) || "";
}

export function setSessionToken(value) {
  if (typeof window !== "undefined") localStorage.setItem(KEY_SESSION, value || "");
}

export function getJwt() {
  return typeof window === "undefined" ? "" : localStorage.getItem(KEY_JWT) || "";
}

export function setJwt(value) {
  if (typeof window !== "undefined") localStorage.setItem(KEY_JWT, value || "");
}

export function clearAuth() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(KEY_API);
    localStorage.removeItem(KEY_API_LIST);
    localStorage.removeItem(KEY_SESSION);
    localStorage.removeItem(KEY_JWT);
  }
}
