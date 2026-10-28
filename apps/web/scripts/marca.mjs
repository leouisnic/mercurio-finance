// Gera todos os arquivos de marca a partir dos dois mestres de assets/brand/.
// As cores vêm de src/app/globals.css, para o ícone nunca divergir da paleta.
// Uso: npm run marca (dentro de apps/web).
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAIZ = path.resolve(WEB, "../..");
const MESTRES = path.join(RAIZ, "assets/brand");

function oklchParaHex(l, c, h) {
  // Matrizes de Björn Ottosson, as mesmas de scripts/contraste.py.
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l3 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m3 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s3 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
  const canal = (v) => {
    const x = Math.min(Math.max(v, 0), 1);
    const srgb = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255);
  };
  return linear.map(canal);
}

async function lerCor(token, tema) {
  const css = await readFile(path.join(WEB, "src/app/globals.css"), "utf8");
  const inicioEscuro = css.indexOf(':root[data-tema="escuro"] {');
  const trecho = tema === "escuro" ? css.slice(inicioEscuro) : css.slice(0, inicioEscuro);
  const achado = new RegExp(`--color-${token}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\)`).exec(trecho);
  if (!achado) throw new Error(`token ${token} do tema ${tema} não encontrado em globals.css`);
  return oklchParaHex(Number(achado[1]) / 100, Number(achado[2]), Number(achado[3]));
}

/**
 * Tira o fundo branco do mestre. Cada pixel foi pintado sobre branco, então a
 * opacidade sai de quanto ele escureceu, e a cor original é recuperada
 * desfazendo a mistura. Com `cor`, o desenho inteiro vira essa cor.
 */
async function semFundo(arquivo, lado, cor) {
  const { data, info } = await sharp(arquivo).resize(lado, lado).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let maisEscuro = 0;
  for (let i = 0; i < data.length; i += 3) {
    maisEscuro = Math.max(maisEscuro, 255 - Math.min(data[i], data[i + 1], data[i + 2]));
  }
  // O mestre vem de JPEG: o pixel mais escuro é ruído, e usá-lo como cheio
  // deixaria o corpo do desenho levemente transparente. 85% dele já é opaco.
  const cheio = maisEscuro * 0.85;
  const saida = Buffer.alloc((data.length / 3) * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const alfa = Math.min(1, (255 - Math.min(data[i], data[i + 1], data[i + 2])) / cheio);
    for (let k = 0; k < 3; k += 1) {
      const original = alfa > 0 ? 255 - (255 - data[i + k]) / alfa : 255;
      saida[j + k] = cor ? cor[k] : Math.round(Math.min(Math.max(original, 0), 255));
    }
    saida[j + 3] = Math.round(alfa * 255);
  }
  return sharp(saida, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** Asa clara sobre um quadro índigo; `raio` arredonda o quadro, `escala` é a fração ocupada pela asa. */
async function ladrilho(lado, { fundo, asa, raio, escala }) {
  const tamanhoDaAsa = Math.round(lado * escala);
  const desenho = await semFundo(path.join(MESTRES, "icone.png"), tamanhoDaAsa, asa);
  const mascara = Buffer.from(
    `<svg width="${lado}" height="${lado}"><rect width="${lado}" height="${lado}" rx="${Math.round(lado * raio)}" fill="#fff"/></svg>`,
  );
  const quadro = await sharp({ create: { width: lado, height: lado, channels: 4, background: { r: fundo[0], g: fundo[1], b: fundo[2], alpha: 1 } } })
    .composite([{ input: mascara, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp(quadro).composite([{ input: desenho, gravity: "center" }]).png().toBuffer();
}

/** Arquivo .ico com uma imagem PNG por tamanho, que todo navegador atual aceita. */
function ico(pngs) {
  const cabecalho = Buffer.alloc(6 + 16 * pngs.length);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(pngs.length, 4);
  let deslocamento = cabecalho.length;
  pngs.forEach(({ lado, dados }, i) => {
    const base = 6 + 16 * i;
    cabecalho.writeUInt8(lado >= 256 ? 0 : lado, base);
    cabecalho.writeUInt8(lado >= 256 ? 0 : lado, base + 1);
    cabecalho.writeUInt16LE(1, base + 4);
    cabecalho.writeUInt16LE(32, base + 6);
    cabecalho.writeUInt32LE(dados.length, base + 8);
    cabecalho.writeUInt32LE(deslocamento, base + 12);
    deslocamento += dados.length;
  });
  return Buffer.concat([cabecalho, ...pngs.map(({ dados }) => dados)]);
}

const marca = await lerCor("marca", "claro");
const prata = await lerCor("tinta-2", "escuro");
const branco = [255, 255, 255];
const ilustracao = path.join(MESTRES, "ilustracao.png");
const icone = path.join(MESTRES, "icone.png");

// Zona segura do ícone mascarável: só um círculo de raio 2/5 do lado aparece
// sempre (W3C Web Application Manifest), então a asa ocupa 56% do quadro.
const arquivos = {
  "public/marca/ilustracao.png": await semFundo(ilustracao, 512),
  "public/marca/ilustracao-escura.png": await semFundo(ilustracao, 512, prata),
  "public/marca/icone.png": await semFundo(icone, 256, marca),
  "public/marca/icone-escuro.png": await semFundo(icone, 256, prata),
  "public/marca/app-192.png": await ladrilho(192, { fundo: marca, asa: branco, raio: 0.22, escala: 0.62 }),
  "public/marca/app-512.png": await ladrilho(512, { fundo: marca, asa: branco, raio: 0.22, escala: 0.62 }),
  "public/marca/app-mascaravel-512.png": await ladrilho(512, { fundo: marca, asa: branco, raio: 0, escala: 0.56 }),
  "public/marca/app-monocromatico-512.png": await semFundo(icone, 512, branco),
  "src/app/icon.png": await ladrilho(192, { fundo: marca, asa: branco, raio: 0.22, escala: 0.62 }),
  // O iOS arredonda o ícone sozinho; quadro cheio evita canto duplo.
  "src/app/apple-icon.png": await ladrilho(180, { fundo: marca, asa: branco, raio: 0, escala: 0.62 }),
};
arquivos["src/app/favicon.ico"] = ico(
  await Promise.all(
    [16, 32, 48].map(async (lado) => ({
      lado,
      // Em 16 px o arredondamento come a asa: quadro quase reto e asa maior.
      dados: await ladrilho(lado, { fundo: marca, asa: branco, raio: lado <= 16 ? 0.12 : 0.22, escala: lado <= 16 ? 0.8 : 0.68 }),
    })),
  ),
);

await mkdir(path.join(WEB, "public/marca"), { recursive: true });
const hashes = {};
for (const [relativo, dados] of Object.entries(arquivos)) {
  await writeFile(path.join(WEB, relativo), dados);
  hashes[relativo] = createHash("sha256").update(dados).digest("hex");
}
await writeFile(path.join(MESTRES, "gerados.json"), `${JSON.stringify(hashes, null, 2)}\n`);
console.log(`${Object.keys(hashes).length} arquivos de marca gerados.`);
