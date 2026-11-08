"""Feriados da cidade: cadastro, carga no calendário e os dias não úteis
para marcar nos gráficos.

O calendário (`finance_api.ciclo`) continua sem banco: este módulo lê a
tabela e entrega os feriados a ele a cada mudança.
"""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from finance_api.ciclo import FeriadoLocal, ciclos_do_mes, definir_feriados_locais, dias_nao_uteis
from finance_api.db import obter_sessao
from finance_api.models import FeriadoORM

rotas = APIRouter()

# Quantos meses para trás o cadastro confere se um ciclo já passado mudou.
MESES_CONFERIDOS = 12


class FeriadoIn(BaseModel):
    nome: str = Field(min_length=1, max_length=60)
    data: date
    repete_todo_ano: bool = True
    muda_ciclo_1: bool = False
    muda_ciclo_2: bool = False

    @field_validator("nome")
    @classmethod
    def nome_sem_espacos_nas_pontas(cls, nome: str) -> str:
        if not nome.strip():
            raise ValueError("nome vazio")
        return nome.strip()


class FeriadoOut(BaseModel):
    id: int
    nome: str
    data: date
    repete_todo_ano: bool
    muda_ciclo_1: bool
    muda_ciclo_2: bool


class FeriadoCriadoOut(FeriadoOut):
    # Feriado novo pode mover o dia de pagamento de um ciclo que já passou, e
    # com isso trocar gasto de ciclo; a tela avisa.
    muda_ciclo_passado: bool


class DiaNaoUtil(BaseModel):
    data: date
    feriado: str | None


def _local(feriado: FeriadoORM) -> FeriadoLocal:
    pagadores = {numero for numero, muda in ((1, feriado.muda_ciclo_1), (2, feriado.muda_ciclo_2)) if muda}
    return FeriadoLocal(feriado.nome, feriado.data, feriado.repete_todo_ano, frozenset(pagadores))


def _out(feriado: FeriadoORM) -> FeriadoOut:
    return FeriadoOut(
        id=feriado.id,
        nome=feriado.nome,
        data=feriado.data,
        repete_todo_ano=feriado.repete_todo_ano,
        muda_ciclo_1=feriado.muda_ciclo_1,
        muda_ciclo_2=feriado.muda_ciclo_2,
    )


async def recarregar(sessao: AsyncSession) -> None:
    """Entrega ao calendário os feriados cadastrados."""
    feriados = (await sessao.scalars(select(FeriadoORM))).all()
    definir_feriados_locais(_local(feriado) for feriado in feriados)


def _ciclos_recentes(hoje: date) -> list:
    ano, mes = hoje.year, hoje.month
    ciclos = []
    for _ in range(MESES_CONFERIDOS + 1):
        ciclos.extend(ciclo for ciclo in ciclos_do_mes(ano, mes) if ciclo.inicio <= hoje)
        ano, mes = (ano - 1, 12) if mes == 1 else (ano, mes - 1)
    return ciclos


@rotas.get("/feriados", response_model=list[FeriadoOut])
async def listar(sessao: AsyncSession = Depends(obter_sessao)) -> list[FeriadoOut]:  # noqa: B008 (padrão do FastAPI)
    feriados = (await sessao.scalars(select(FeriadoORM).order_by(FeriadoORM.data))).all()
    return [_out(feriado) for feriado in feriados]


@rotas.post("/feriados", response_model=FeriadoCriadoOut, status_code=201)
async def criar(
    feriado: FeriadoIn,
    hoje: date | None = None,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> FeriadoCriadoOut:
    """`hoje` existe para os testes fixarem a data."""
    dia = hoje or date.today()  # noqa: DTZ011 (feriado é data civil, sem fuso)
    antes = _ciclos_recentes(dia)
    novo = FeriadoORM(**feriado.model_dump())
    sessao.add(novo)
    await sessao.commit()
    await recarregar(sessao)
    return FeriadoCriadoOut(**_out(novo).model_dump(), muda_ciclo_passado=_ciclos_recentes(dia) != antes)


@rotas.put("/feriados/{feriado_id}", response_model=FeriadoCriadoOut)
async def editar(
    feriado_id: int,
    feriado: FeriadoIn,
    hoje: date | None = None,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> FeriadoCriadoOut:
    """Troca o feriado inteiro, com o mesmo aviso de ciclo passado do cadastro."""
    existente = await sessao.get(FeriadoORM, feriado_id)
    if existente is None:
        raise HTTPException(status_code=404, detail="feriado não encontrado")
    dia = hoje or date.today()  # noqa: DTZ011 (feriado é data civil, sem fuso)
    antes = _ciclos_recentes(dia)
    for campo, valor in feriado.model_dump().items():
        setattr(existente, campo, valor)
    await sessao.commit()
    await recarregar(sessao)
    return FeriadoCriadoOut(**_out(existente).model_dump(), muda_ciclo_passado=_ciclos_recentes(dia) != antes)


@rotas.delete("/feriados/{feriado_id}", status_code=204)
async def apagar(
    feriado_id: int,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> None:
    resultado = await sessao.execute(delete(FeriadoORM).where(FeriadoORM.id == feriado_id))
    if resultado.rowcount == 0:
        raise HTTPException(status_code=404, detail="feriado não encontrado")
    await sessao.commit()
    await recarregar(sessao)


@rotas.get("/dias-nao-uteis", response_model=list[DiaNaoUtil])
async def nao_uteis(
    data_inicio: date,
    data_fim: date = Query(),  # noqa: B008 (padrão do FastAPI)
) -> list[DiaNaoUtil]:
    """Fim de semana e feriado (nacional ou da cidade) no intervalo, para os
    gráficos marcarem. Feriado da cidade aparece mesmo sem mudar pagamento."""
    if data_fim < data_inicio or data_fim - data_inicio > timedelta(days=366):
        raise HTTPException(status_code=422, detail="intervalo inválido")
    return [DiaNaoUtil(data=dia, feriado=nome) for dia, nome in dias_nao_uteis(data_inicio, data_fim).items()]
