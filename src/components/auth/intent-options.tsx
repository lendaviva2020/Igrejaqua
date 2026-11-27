import { Church, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SignupIntent } from "@/modules/identity/schemas";

/** Textos dos dois caminhos de entrada. Só orientam as telas: quem escolhe "liderança" não ganha permissão nenhuma por isso. */
export const INTENT_OPTIONS: readonly { value: SignupIntent; title: string; description: string; Icon: LucideIcon }[] = [
  {
    value: "leader",
    title: "Sou pastor(a) ou da liderança",
    description: "Quero cadastrar minha igreja e convidar as pessoas.",
    Icon: Church,
  },
  {
    value: "member",
    title: "Faço parte de uma igreja",
    description: "Recebi um link ou convite da minha igreja.",
    Icon: Users,
  },
];
