import path from "path";
import { mkdir, writeFile, readFile } from "fs/promises";
import { PerfilEstilo, type ReferenciaItem, type FonteReferencia } from "../contracts";
import { descreverImagem, gerarTexto } from "../llm/ollama";

// Perfil salvo em disco — escrito localmente (visão roda no Ollama local) e LIDO na geração.
// Para produção (Vercel, fs read-only), comite o JSON gerado: a leitura funciona em prod.
const ARQUIVO = path.join(process.cwd(), "data", "referencias", "perfil-estilo.json");

// Sufixo determinístico do Flux: restrições de formato/negação que NÃO dependem do modelo.
// Espelha o fim do ESTILO_INDEBA (gerar-instagram.ts) — o descritor derivado é drop-in dele.
const SUFIXO_FLUX =
  "vertical 4:5, no text, no letters, no numbers, no watermark, no logos, no labels";

const PROMPT_VISAO =
  "You are an art director analyzing an Instagram photo. Describe ONLY its VISUAL STYLE " +
  "as a concise comma-separated English fragment for a text-to-image prompt: lighting, " +
  "color palette, mood, framing and composition, camera feel, and texture or grain. " +
  "Do NOT describe the subject, people, products or content — only the look. Max 35 words. " +
  "Output only the fragment, no preamble.";

function promptSintese(notas: string[]): string {
  return `Você é diretor de arte. Abaixo estão descrições de ESTILO de ${notas.length} fotos de referência.
Destile UM único estilo visual consistente, como fragmento ÚNICO em INGLÊS separado por vírgulas,
para um prompt text-to-image (Flux). Cubra: iluminação, paleta de cores, mood, enquadramento/composição,
sensação de câmera e textura/grão. NÃO descreva assunto, pessoas ou produtos — só a aparência.
NÃO escreva proporção (4:5) nem negações (no text/no logo): o sistema acrescenta isso. Máx. 50 palavras.
Responda APENAS o fragmento, sem preâmbulo.

DESCRIÇÕES:
${notas.map((n, i) => `${i + 1}. ${n}`).join("\n")}`;
}

// Posts de referência (imagem + legenda) → perfil de estilo derivado (procedência IA-TEXTO).
export async function analisarReferencias(itens: ReferenciaItem[]): Promise<PerfilEstilo> {
  const fontes: FonteReferencia[] = [];
  const notas: string[] = [];

  for (const item of itens) {
    let notaVisual: string | null = null;
    if (item.imagemBase64) {
      try {
        notaVisual = await descreverImagem(PROMPT_VISAO, item.imagemBase64);
        if (notaVisual) notas.push(notaVisual);
      } catch {
        // Imagem ilegível / modelo de visão indisponível → ignora essa imagem, segue.
      }
    }
    fontes.push({ arquivo: item.nomeArquivo, notaVisual });
  }

  // Sem nenhuma nota visual (nenhuma imagem ou visão indisponível) → não dá pra derivar estilo.
  if (notas.length === 0) {
    throw new Error(
      "Nenhuma imagem de referência pôde ser analisada (modelo de visão indisponível ou imagens inválidas).",
    );
  }

  const sintese = (await gerarTexto(promptSintese(notas)))
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[\s,]+$/g, "")
    .trim();

  const descritorVisual = `${sintese}, ${SUFIXO_FLUX}`;
  const exemplosLegenda = itens.map((i) => i.legenda?.trim()).filter((l): l is string => !!l);

  return {
    descritorVisual,
    exemplosLegenda,
    fontes,
    atualizadoEm: new Date().toISOString(),
  };
}

export async function salvarPerfilEstilo(perfil: PerfilEstilo): Promise<void> {
  await mkdir(path.dirname(ARQUIVO), { recursive: true });
  await writeFile(ARQUIVO, JSON.stringify(perfil, null, 2), "utf8");
}

// Lê o perfil salvo; ausente ou inválido → null (a geração cai no ESTILO_INDEBA fixo).
export async function carregarPerfilEstilo(): Promise<PerfilEstilo | null> {
  try {
    const cru = await readFile(ARQUIVO, "utf8");
    return PerfilEstilo.parse(JSON.parse(cru));
  } catch {
    return null;
  }
}
