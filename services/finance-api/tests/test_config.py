import pytest
from finance_api.config import validar_banco_de_teste, validar_url_local_de_teste


def test_banco_de_teste_local_e_separado_e_aceito() -> None:
    validar_banco_de_teste(
        "postgresql+asyncpg://usuario:senha@127.0.0.1:5432/mercurio_test",
        "postgresql+asyncpg://usuario:senha@127.0.0.1:5432/mercurio",
    )


@pytest.mark.parametrize(
    ("teste", "desenvolvimento", "mensagem"),
    [
        (
            "postgresql+asyncpg://usuario:senha@127.0.0.1:5432/mercurio",
            "postgresql+asyncpg://usuario:senha@127.0.0.1:5432/mercurio",
            "não pode ser igual",
        ),
        (
            "postgresql+asyncpg://usuario:senha@db.exemplo:5432/mercurio_test",
            "postgresql+asyncpg://usuario:senha@127.0.0.1:5432/mercurio",
            "computador local",
        ),
        (
            "postgresql+asyncpg://usuario:senha@127.0.0.1:5432/descartavel",
            "postgresql+asyncpg://usuario:senha@127.0.0.1:5432/mercurio",
            "terminar em _test",
        ),
    ],
)
def test_banco_de_teste_inseguro_e_recusado(
    teste: str, desenvolvimento: str, mensagem: str
) -> None:
    with pytest.raises(RuntimeError, match=mensagem):
        validar_banco_de_teste(teste, desenvolvimento)


def test_url_local_de_teste_aceita_banco_descartavel() -> None:
    validar_url_local_de_teste(
        "postgresql+asyncpg://usuario:senha@127.0.0.1:5432/mercurio_e2e_test"
    )
