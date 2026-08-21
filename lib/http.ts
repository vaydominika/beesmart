export async function readJsonSafely<T>(response: Response, fallback: T): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    return fallback;
  }
}
