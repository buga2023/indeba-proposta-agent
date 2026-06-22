// Cliente do Stable Diffusion local — API compatível com AUTOMATIC1111 / Forge / SD.Next
// (endpoint /sdapi/v1/txt2img). Gera imagem quadrada 1:1 a partir de um prompt em inglês.
const BASE = process.env.SD_BASE_URL ?? "http://127.0.0.1:7860";
const STEPS = Number(process.env.SD_STEPS ?? "25");
const SIZE = Number(process.env.SD_SIZE ?? "1024"); // 1:1 — baixe p/ 768 se faltar VRAM na 3060

const NEGATIVO =
  "text, letters, words, watermark, signature, logo, lowres, blurry, deformed, ugly, jpeg artifacts";

export async function sdDisponivel(): Promise<boolean> {
  // Produção sem SD configurado → não tenta (evita timeout a cada requisição).
  if (process.env.VERCEL && !process.env.SD_BASE_URL) return false;
  try {
    const r = await fetch(`${BASE}/sdapi/v1/sd-models`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

// prompt (inglês) → data URL PNG (base64). Lança em caso de falha.
export async function gerarImagem(prompt: string): Promise<string> {
  const r = await fetch(`${BASE}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: prompt.slice(0, 1500),
      negative_prompt: NEGATIVO,
      width: SIZE,
      height: SIZE,
      steps: STEPS,
      cfg_scale: 6.5,
      sampler_name: "DPM++ 2M",
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!r.ok) throw new Error(`Stable Diffusion ${r.status}`);
  const data = (await r.json()) as { images?: string[] };
  const b64 = data.images?.[0];
  if (!b64) throw new Error("Stable Diffusion não retornou imagem");
  return `data:image/png;base64,${b64}`;
}
