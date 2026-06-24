// Quebra texto longo em pedaços (~1600 chars) respeitando parágrafos. Sem overlap (MVP).
export function chunk(texto: string, max = 1600): string[] {
  const limpo = texto.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!limpo) return [];

  const paras = limpo.split(/\n\n+/);
  const out: string[] = [];
  let buf = "";
  for (const p of paras) {
    if (buf && (buf + "\n\n" + p).length > max) {
      out.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
    while (buf.length > max) {
      out.push(buf.slice(0, max).trim());
      buf = buf.slice(max);
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}
