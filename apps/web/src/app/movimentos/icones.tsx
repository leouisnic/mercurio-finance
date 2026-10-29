import {
  Baby,
  BedDouble,
  Beer,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Camera,
  Car,
  Coffee,
  Dog,
  Dumbbell,
  Ellipsis,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Hammer,
  Heart,
  HeartPulse,
  House,
  Laptop,
  Leaf,
  type LucideIcon,
  Music,
  PartyPopper,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Receipt,
  Repeat,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Ticket,
  Users,
  Utensils,
  Wallet,
  Wrench,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { Categoria } from "../buscar-movimentos";

/** Os ícones das 19 categorias da migração e os que o dono pode escolher ao
 *  criar uma. A API guarda só o nome; nome desconhecido vira reticências. */
const ICONES: Record<string, LucideIcon> = {
  Utensils,
  ShoppingCart,
  Car,
  HeartPulse,
  Pill,
  Plane,
  House,
  Repeat,
  GraduationCap,
  ShoppingBag,
  Shirt,
  PartyPopper,
  Wrench,
  Gift,
  Users,
  PiggyBank,
  Wallet,
  Receipt,
  Ellipsis,
  Dog,
  Baby,
  Dumbbell,
  Bike,
  Bus,
  Fuel,
  Coffee,
  Beer,
  Pizza,
  Gamepad2,
  Music,
  Film,
  BookOpen,
  Laptop,
  Smartphone,
  Scissors,
  Sparkles,
  Heart,
  Briefcase,
  Building2,
  Hammer,
  Leaf,
  Ticket,
  Camera,
  Tag,
  BedDouble,
};

export const ICONES_PARA_CRIAR = [
  "Dog",
  "Baby",
  "Dumbbell",
  "Bike",
  "Bus",
  "Fuel",
  "Coffee",
  "Beer",
  "Pizza",
  "Gamepad2",
  "Music",
  "Film",
  "BookOpen",
  "Laptop",
  "Smartphone",
  "Scissors",
  "Sparkles",
  "Heart",
  "Briefcase",
  "Building2",
  "Hammer",
  "Leaf",
  "Ticket",
  "Camera",
];

/** Só o tom: claridade e croma vêm de `--categoria-fundo` e `--categoria-icone`. */
export const CORES_PARA_CRIAR = [45, 75, 140, 160, 200, 230, 265, 290, 320, 350];

export function IconeDaCategoria({ nome, tamanho }: { nome: string; tamanho: number }) {
  const Icone = ICONES[nome] ?? Ellipsis;
  return <Icone size={tamanho} strokeWidth={2} aria-hidden="true" />;
}

export function BolaDaCategoria({
  categoria,
  tamanho = 30,
}: {
  categoria: Pick<Categoria, "icone" | "cor">;
  tamanho?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="categoria-bola inline-grid shrink-0 place-items-center rounded-full"
      style={{ "--tom": categoria.cor, width: tamanho, height: tamanho } as CSSProperties}
    >
      {categoria.icone && <IconeDaCategoria nome={categoria.icone} tamanho={Math.round(tamanho * 0.55)} />}
    </span>
  );
}

/** Os ícones que uma tag pode ter: viagem, obra, festa, família, esporte. */
export const ICONES_DE_TAG = ["Plane", "Hammer", "Gift", "PartyPopper", "Baby", "Dumbbell", "Car", "House", "Heart", "Briefcase", "Ticket", "Tag"];
