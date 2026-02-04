export class HttpError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

type Json =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  token?: string | null;
  body?: Json;
  headers?: Record<string, string>;
};

export async function requestJson<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", token, body, headers = {} } = options;

  const res = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const parsedBody = isJson
    ? ((await res.json()) as unknown)
    : await res.text();

  if (!res.ok) {
    const message =
      typeof parsedBody === "object" &&
      parsedBody &&
      "message" in (parsedBody as any)
        ? String((parsedBody as any).message)
        : `Request failed with ${res.status}`;

    throw new HttpError(message, res.status, parsedBody);
  }

  return parsedBody as T;
}
