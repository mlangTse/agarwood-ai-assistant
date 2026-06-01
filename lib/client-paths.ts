const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

export function apiPath(path: string) {
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}
