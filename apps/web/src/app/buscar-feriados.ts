import { buscarJson } from "./api";

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

/** Fim de semana e feriado do intervalo; `feriado` é o nome, ou null no fim de semana. */
export type DiaNaoUtil = { data: string; feriado: string | null };

export async function buscarDiasNaoUteis(
  inicio: string,
  fim: string,
): Promise<DiaNaoUtil[] | null> {
  return buscarJson<DiaNaoUtil[]>("/dias-nao-uteis", {
    data_inicio: inicio,
    data_fim: fim,
  });
}

/** O dia na lista de não úteis: undefined se é dia útil, null se é fim de semana, o nome se é feriado. */
export function marcaDoDia(
  naoUteis: DiaNaoUtil[],
  data: string,
): string | null | undefined {
  const dia = naoUteis.find((item) => item.data === data);
  return dia ? dia.feriado : undefined;
}
