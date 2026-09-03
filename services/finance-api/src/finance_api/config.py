"""Configuração de ambiente do finance-api.

Carrega `.env` da raiz do repositório (não do diretório do serviço), porque
é onde ficam as credenciais reais, fora do Git. Ver docs/security.md.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

RAIZ_DO_REPOSITORIO = Path(__file__).resolve().parents[4]
load_dotenv(RAIZ_DO_REPOSITORIO / ".env")

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://mercurio:mercurio@127.0.0.1:5432/mercurio"
)

# Banco separado para os testes automatizados. Nunca aponta para o mesmo
# banco de DATABASE_URL: os testes truncam as tabelas a cada execução, e
# DATABASE_URL é o único que recebe dado real do Pluggy.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://mercurio:mercurio@127.0.0.1:5432/mercurio_test",
)

REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")

PLUGGY_CLIENT_ID = os.environ.get("PLUGGY_CLIENT_ID")
PLUGGY_CLIENT_SECRET = os.environ.get("PLUGGY_CLIENT_SECRET")
PLUGGY_ITEM_ID_PJ = os.environ.get("PLUGGY_ITEM_ID_PJ")
PLUGGY_ITEM_ID_PF = os.environ.get("PLUGGY_ITEM_ID_PF")
