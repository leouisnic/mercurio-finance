import { buscarJson } from "./api";
import type { DiaNaoUtil } from "./dia-nao-util";

/** Feriado da cidade cadastrado pelo dono. Os nacionais vêm do calendário da API. */
export type Feriado = {
  id: number;
  nome: string;
  data: string;
  repeteTodoAno: boolean;
  mudaCiclo1: boolean;
  mudaCiclo2: boolean;
};

type LinhaDeFeriado = {
  id: number;
  nome: string;
  data: string;
  repete_todo_ano: boolean;
  muda_ciclo_1: boolean;
  muda_ciclo_2: boolean;
};

export async function buscarFeriados(): Promise<Feriado[] | null> {
  const linhas = await buscarJson<LinhaDeFeriado[]>("/feriados");
  return (
    linhas?.map((linha) => ({
      id: linha.id,
      nome: linha.nome,
      data: linha.data,
      repeteTodoAno: linha.repete_todo_ano,
      mudaCiclo1: linha.muda_ciclo_1,
      mudaCiclo2: linha.muda_ciclo_2,
    })) ?? null
  );
}

export type { DiaNaoUtil };

export async function buscarDiasNaoUteis(
  inicio: string,
  fim: string,
): Promise<DiaNaoUtil[] | null> {
  return buscarJson<DiaNaoUtil[]>("/dias-nao-uteis", {
    data_inicio: inicio,
    data_fim: fim,
  });
}
