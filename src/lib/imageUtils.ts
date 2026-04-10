export function imageUrlToBase64(url: string): Promise<{ base64: string; mediaType: string }> {
  return fetch(url)
    .then((res) => {
      const contentType = res.headers.get("content-type") || "image/jpeg";
      return res.arrayBuffer().then((buf) => ({
        base64: Buffer.from(buf).toString("base64"),
        mediaType: contentType.split(";")[0],
      }));
    })
    .catch(() => {
      throw new Error(`Failed to fetch image from URL: ${url}`);
    });
}
