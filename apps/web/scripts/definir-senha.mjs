// Define a senha do painel: pede a senha duas vezes, sem mostrar, e grava só
// o hash em PAINEL_SENHA_HASH no .env da raiz. A senha nunca vai para arquivo.
// Uso, num PowerShell aberto na raiz do repositório:
//   node apps\web\scripts\definir-senha.mjs
// Depois, desligar e abrir o Mercúrio pelo atalho.

import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

// Parâmetros do scrypt guardados no próprio hash, para poderem subir no
// futuro sem invalidar a senha atual. N = 2^14 é o custo recomendado pelo
// Node para uso interativo.
const N = 16384;
const R = 8;
const P = 1;
const TAMANHO = 32;
const MINIMO = 8;

export function gerarHash(senha, sal = randomBytes(16)) {
  const chave = scryptSync(senha, sal, TAMANHO, { N, r: R, p: P });
  return ["scrypt", N, R, P, sal.toString("base64url"), chave.toString("base64url")].join("$");
}

function perguntarOculto(pergunta) {
  return new Promise((resolver) => {
    const entrada = process.stdin;
    process.stdout.write(pergunta);
    if (!entrada.isTTY) {
      // Sem terminal interativo não dá para esconder: lê a linha como vier.
      let texto = "";
      entrada.setEncoding("utf8");
      entrada.once("data", (pedaco) => {
        texto = String(pedaco).split(/\r?\n/)[0];
        process.stdout.write("\n");
        resolver(texto);
      });
      return;
    }
    let texto = "";
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding("utf8");
    const aoDigitar = (tecla) => {
      for (const caractere of tecla) {
        if (caractere === "\r" || caractere === "\n") {
          entrada.setRawMode(false);
          entrada.pause();
          entrada.off("data", aoDigitar);
          process.stdout.write("\n");
          resolver(texto);
          return;
        }
        if (caractere === "\u0003") {
          process.stdout.write("\n");
          process.exit(1);
        }
        if (caractere === "\u007f" || caractere === "\b") {
          texto = texto.slice(0, -1);
        } else {
          texto += caractere;
        }
      }
    };
    entrada.on("data", aoDigitar);
  });
}

function gravarNoEnv(arquivo, nome, valor) {
  const linhas = existsSync(arquivo) ? readFileSync(arquivo, "utf8").split(/\r?\n/) : [];
  const indice = linhas.findIndex((linha) => linha.startsWith(`${nome}=`));
  if (indice >= 0) {
    linhas[indice] = `${nome}=${valor}`;
  } else {
    if (linhas.length > 0 && linhas[linhas.length - 1] === "") linhas.pop();
    linhas.push(`${nome}=${valor}`);
  }
  writeFileSync(arquivo, `${linhas.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}

async function principal() {
  const raiz = join(dirname(resolve(process.argv[1])), "..", "..", "..");
  const senha = await perguntarOculto("Nova senha do painel: ");
  if (senha.length < MINIMO) {
    console.error(`A senha precisa de pelo menos ${MINIMO} caracteres. Nada foi gravado.`);
    process.exit(1);
  }
  const repetida = await perguntarOculto("Repita a senha: ");
  if (repetida !== senha) {
    console.error("As duas senhas não batem. Nada foi gravado.");
    process.exit(1);
  }
  gravarNoEnv(join(raiz, ".env"), "PAINEL_SENHA_HASH", gerarHash(senha));
  console.log("Senha definida. Desligue e abra o Mercúrio pelo atalho para valer.");
}

// Sem `import.meta` nem `await` solto: o Playwright importa este arquivo pela
// configuração e o converte para CommonJS, onde nenhum dos dois existe.
if (process.argv[1] && basename(process.argv[1]) === "definir-senha.mjs") {
  principal().catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
}
