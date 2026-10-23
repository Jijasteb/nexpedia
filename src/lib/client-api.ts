/** Read API responses defensively so empty/HTML 500 responses never surface as
 * the opaque "Unexpected end of JSON input" browser error. */
export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(response.ok
      ? "Server tidak mengirim respons. Coba muat ulang halaman."
      : `Server sedang bermasalah (HTTP ${response.status}). Coba lagi beberapa saat.`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(response.ok
      ? "Respons server tidak valid. Coba muat ulang halaman."
      : `Server sedang bermasalah (HTTP ${response.status}). Coba lagi beberapa saat.`);
  }
}
