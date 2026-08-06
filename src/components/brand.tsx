// Marca Indeba Express — a logo OFICIAL, servida de public/marca/.
// Antes daqui saía um "ies" desenhado em SVG (retângulo + texto), que só lembrava
// a marca de longe. Os arquivos oficiais já viviam no repo (o PDF de proposta os
// usa desde sempre); a tela agora bebe da mesma fonte.
//
// Duas variantes: "color" (fundo claro — card de login) e "white" (fundo navy —
// sidebar, rodapé). O recorte do símbolo e do wordmark saiu da própria logo
// oficial, então nada aqui é redesenho.

type Variante = "color" | "white";

const SIMBOLO: Record<Variante, string> = {
  color: "/marca/indeba-express-simbolo.png",
  white: "/marca/indeba-express-simbolo-white.png",
};
const WORDMARK: Record<Variante, string> = {
  color: "/marca/indeba-express-wordmark.png",
  white: "/marca/indeba-express-wordmark-white.png",
};
const COMPLETA: Record<Variante, string> = {
  color: "/marca/indeba-express-logo.png",
  white: "/marca/indeba-express-logo-white.png",
};

type Props = {
  /** Altura em px. A largura acompanha a proporção do arquivo. */
  altura?: number;
  variante?: Variante;
  /** "" marca a imagem como decorativa — use quando a marca já é lida ao lado. */
  alt?: string;
  className?: string;
};

/** Só o símbolo "ies". É o que sobra quando a sidebar colapsa em trilha de ícones. */
export function Logo({ altura = 34, variante = "color", alt = "Indeba Express", className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SIMBOLO[variante]}
      alt={alt}
      className={className}
      style={{ height: `${altura}px`, width: "auto", display: "block", flex: "none" }}
    />
  );
}

/** Só o lettering "indeba express". */
export function Wordmark({ altura = 18, variante = "color", alt = "Indeba Express", className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={WORDMARK[variante]}
      alt={alt}
      className={className}
      style={{ height: `${altura}px`, width: "auto", display: "block" }}
    />
  );
}

/** Logo completa (símbolo sobre o lettering) — a assinatura das telas de acesso. */
export function LogoCompleta({ altura = 84, variante = "color", alt = "Indeba Express", className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={COMPLETA[variante]}
      alt={alt}
      className={className}
      style={{ height: `${altura}px`, width: "auto", display: "block" }}
    />
  );
}
