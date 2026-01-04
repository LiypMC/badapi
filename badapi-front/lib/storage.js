const KEY_API = "badapi_api_key";
const KEY_SESSION = "badapi_session_token";
const KEY_JWT = "badapi_jwt";

export function getApiKey() {
  return typeof window === "undefined" ? "" : localStorage.getItem(KEY_API) || "";
}

export function setApiKey(value) {
  if (typeof window !== "undefined") localStorage.setItem(KEY_API, value || "");
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
    localStorage.removeItem(KEY_SESSION);
    localStorage.removeItem(KEY_JWT);
  }
}
