const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://badapi.fly.dev";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail = data?.detail || res.statusText;
    const error = new Error(detail);
    error.status = res.status;
    error.payload = data;
    throw error;
  }

  return { data, headers: res.headers };
}

export { API_URL, request };
