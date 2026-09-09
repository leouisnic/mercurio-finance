"""Verifica conteúdo versionável sem ler arquivos ignorados ou segredos locais."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
EXTENSOES_TEXTO = {
    ".css",
    ".html",
    ".ini",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".py",
    ".sh",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
}
EXTENSOES_PROIBIDAS = {".cer", ".crt", ".key", ".p12", ".pem", ".pfx"}
TEXTOS_PROIBIDOS = {
    "\N{EM DASH}": "travessão",
    "Co" + "-Authored-By": "atribuição pública",
    "Generated with " + "Claude": "atribuição pública",
    "Generated with " + "Codex": "atribuição pública",
    "Gen" + "ux": "nome real em conteúdo versionável",
    "Tra" + "gial": "nome real em conteúdo versionável",
}


def _git(*argumentos: str) -> bytes:
    return subprocess.check_output(["git", *argumentos], cwd=RAIZ)


def arquivos_versionaveis(staged: bool) -> list[Path]:
    if staged:
        saida = _git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z")
    else:
        saida = _git("ls-files", "--cached", "--others", "--exclude-standard", "-z")
    return [RAIZ / nome.decode("utf-8") for nome in saida.split(b"\0") if nome]


def validar(staged: bool) -> list[str]:
    erros: list[str] = []
    for caminho in arquivos_versionaveis(staged):
        if not caminho.is_file():
            continue
        relativo = caminho.relative_to(RAIZ).as_posix()
        if caminho.suffix.lower() in EXTENSOES_PROIBIDAS:
            erros.append(f"{relativo}: certificado ou chave privada não pode ser versionado")
            continue
        if caminho.suffix.lower() not in EXTENSOES_TEXTO and caminho.name not in {
            ".gitattributes",
            ".gitignore",
        }:
            continue
        try:
            conteudo = caminho.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            erros.append(f"{relativo}: arquivo textual não está em UTF-8")
            continue
        for numero, linha in enumerate(conteudo.splitlines(), 1):
            for texto, motivo in TEXTOS_PROIBIDOS.items():
                if texto in linha:
                    erros.append(f"{relativo}:{numero}: {motivo}")
    return erros


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--staged", action="store_true")
    args = parser.parse_args()
    erros = validar(args.staged)
    if erros:
        print("Conteúdo reprovado:")
        print("\n".join(f"  {erro}" for erro in erros))
        return 1
    print("Conteúdo aprovado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
