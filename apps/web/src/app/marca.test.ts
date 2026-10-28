// @vitest-environment node
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const WEB = path.resolve(__dirname, "../..");
const GERADOS: Record<string, string> = JSON.parse(
  readFileSync(path.resolve(WEB, "../../assets/brand/gerados.json"), "utf8"),
);

function hash(relativo: string): string {
  return createHash("sha256").update(readFileSync(path.join(WEB, relativo))).digest("hex");
}

test("cada arquivo de marca é o que o script gerou", () => {
  // Arquivo ajustado à mão diverge das outras variantes na primeira troca de
  // cor: quem mudar a marca roda `npm run marca`, que refaz tudo e o registro.
  for (const [relativo, esperado] of Object.entries(GERADOS)) {
    expect(hash(relativo), relativo).toBe(esperado);
  }
});

test("não existe arquivo de marca fora do que o script gera", () => {
  const publicos = readdirSync(path.join(WEB, "public/marca")).map((nome) => `public/marca/${nome}`);
  const doApp = ["favicon.ico", "icon.png", "apple-icon.png"].map((nome) => `src/app/${nome}`);

  for (const relativo of [...publicos, ...doApp]) {
    expect(Object.keys(GERADOS), relativo).toContain(relativo);
  }
});
