"""Executa a validação local completa do Mercúrio."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]


def executar(
    comando: list[str],
    pasta: Path = RAIZ,
    ambiente: dict[str, str] | None = None,
) -> None:
    print(f"Executando: {' '.join(comando)}", flush=True)
    env = os.environ.copy()
    env.update(ambiente or {})
    subprocess.run(comando, cwd=pasta, env=env, check=True)


def executavel_npm() -> str:
    nome = "npm.cmd" if os.name == "nt" else "npm"
    caminho = shutil.which(nome)
    if caminho is None:
        raise RuntimeError(f"{nome} não foi encontrado no PATH")
    return caminho


def remover_instrucao_gerada_do_next() -> None:
    caminho = RAIZ / "apps" / "web" / "AGENTS.md"
    ignorado = subprocess.run(
        ["git", "check-ignore", "--no-index", "--quiet", "apps/web/AGENTS.md"],
        cwd=RAIZ,
        check=False,
    ).returncode == 0
    if caminho.exists() and ignorado:
        caminho.unlink()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--e2e", action="store_true", help="inclui Playwright")
    args = parser.parse_args()
    try:
        executar([sys.executable, "scripts/validar_conteudo.py"])
        executar([sys.executable, "-m", "ruff", "check", "."])
        executar(
            [
                sys.executable,
                "-m",
                "pytest",
                "--basetemp",
                ".test-tmp",
                "-o",
                "cache_dir=.test-cache",
            ]
        )
        web = RAIZ / "apps" / "web"
        npm = executavel_npm()
        executar([npm, "run", "lint"], web)
        executar([npm, "run", "test"], web)
        try:
            executar([npm, "run", "build"], web, {"NEXT_DIST_DIR": ".next-validacao"})
            if args.e2e:
                executar([npm, "run", "test:e2e"], web)
        finally:
            remover_instrucao_gerada_do_next()
    except (RuntimeError, subprocess.CalledProcessError) as erro:
        if isinstance(erro, RuntimeError):
            print(erro)
            return 1
        return erro.returncode
    return 0


if __name__ == "__main__":
    sys.exit(main())
