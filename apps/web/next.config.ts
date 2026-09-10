import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // O Next reescreve AGENTS.md e CLAUDE.md a cada `next dev` com um bloco
  // proprio. Aqui CLAUDE.md e' versionado e so' pode conter `@AGENTS.md`, e o
  // bloco gerado usa travessao, que a validacao de conteudo barra.
  agentRules: false,
};

export default nextConfig;
