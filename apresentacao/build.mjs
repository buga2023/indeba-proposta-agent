/**
 * Gera o vídeo narrado e o PDF da apresentação a partir de index.html.
 *
 *   node apresentacao/build.mjs [pastaSaida]
 *
 * Narração: atributo data-narracao de cada .slide (voz neural pt-BR da Microsoft, via msedge-tts).
 * Requer: playwright (já no projeto), ffmpeg (FFMPEG env ou ~/.claude/tools/whisper/ffmpeg.exe)
 * e msedge-tts (npm i msedge-tts no diretório apontado por TTS_DIR, ou no projeto).
 */
import { chromium } from "playwright";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(os.homedir(), "Downloads"));
const tmp = path.join(here, ".build");
fs.mkdirSync(tmp, { recursive: true });

const FFMPEG = process.env.FFMPEG ?? path.join(os.homedir(), ".claude", "tools", "whisper", "ffmpeg.exe");
const require = createRequire(path.join(process.env.TTS_DIR ?? here, "package.json"));
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const VOICE = process.env.VOICE ?? "pt-BR-AntonioNeural";
const FPS = 30, W = 1920, H = 1080, XFADE = 0.6, PAD_IN = 0.5, PAD_OUT = 1.0;

const ff = (args) => execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
function duration(file) {
  let txt = "";
  try { execFileSync(FFMPEG, ["-hide_banner", "-i", file], { stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { txt = String(e.stderr); }
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(txt);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
}

const browser = await chromium.launch();
const url = "file:///" + path.join(here, "index.html").split(path.sep).join("/");

// 1) Slides (modo vídeo: legenda visível, navegação escondida)
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(url);
await page.evaluate(() => document.body.classList.add("video"));
await page.waitForTimeout(500);
const narracoes = await page.$$eval(".slide", (els) => els.map((e) => e.getAttribute("data-narracao") ?? ""));
const n = narracoes.length;
for (let i = 0; i < n; i++) {
  await page.evaluate((k) => window.__go(k), i);
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(tmp, `slide${i}.png`) });
}
console.log(`${n} slides capturados`);

// 2) PDF (modo apresentação: sem legenda)
const pdfPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await pdfPage.goto(url);
await pdfPage.emulateMedia({ media: "print" });
await pdfPage.waitForTimeout(400);
await pdfPage.pdf({ path: path.join(out, "Indeba_Express_Apresentacao.pdf"), width: "1280px", height: "720px", printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log("PDF gerado");

// 3) Narração
const tts = new MsEdgeTTS();
await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
const segs = [];
for (let i = 0; i < n; i++) {
  const dir = path.join(tmp, `tts${i}`);
  fs.mkdirSync(dir, { recursive: true });
  const { audioFilePath } = await tts.toFile(dir, narracoes[i], { rate: "-4%" });
  const voice = path.join(tmp, `voz${i}.wav`);
  ff(["-i", audioFilePath, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2", voice]);
  const len = PAD_IN + duration(voice) + PAD_OUT;
  const seg = path.join(tmp, `seg${i}.mp4`);
  // Imagem parada com leve zoom (Ken Burns) + voz com respiro antes e depois.
  ff([
    "-loop", "1", "-framerate", String(FPS), "-i", path.join(tmp, `slide${i}.png`),
    "-i", voice,
    "-filter_complex",
    `[0:v]scale=${W * 1.08}:-1,zoompan=z='min(1+0.00025*on,1.03)':d=${Math.ceil(len * FPS)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},format=yuv420p[v];` +
    `[1:a]adelay=${Math.round(PAD_IN * 1000)}|${Math.round(PAD_IN * 1000)},apad=whole_dur=${len}[a]`,
    "-map", "[v]", "-map", "[a]", "-t", String(len), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "160k", seg,
  ]);
  segs.push({ file: seg, len });
  console.log(`slide ${i + 1}/${n}: ${len.toFixed(1)}s`);
}

// 4) Concatena com crossfade de vídeo e áudio
const inputs = segs.flatMap((s) => ["-i", s.file]);
let fc = "", vprev = "[0:v]", aprev = "[0:a]", offset = 0;
for (let i = 1; i < segs.length; i++) {
  offset += segs[i - 1].len - XFADE;
  const vo = i === segs.length - 1 ? "[vout]" : `[v${i}]`;
  const ao = i === segs.length - 1 ? "[aout]" : `[a${i}]`;
  fc += `${vprev}[${i}:v]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}${vo};`;
  fc += `${aprev}[${i}:a]acrossfade=d=${XFADE}${ao};`;
  vprev = vo; aprev = ao;
}
const final = path.join(out, "Indeba_Express_Apresentacao.mp4");
ff([...inputs, "-filter_complex", fc.slice(0, -1), "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", final]);
console.log(`vídeo: ${final} (${(offset + segs.at(-1).len).toFixed(0)}s)`);
