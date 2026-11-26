import type { SocialNetwork } from "@/lib/site";

/** Glifos próprios e simples (traço), decorativos: o nome acessível fica no link. */
export function SocialIcon({ network }: { network: SocialNetwork }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false };
  switch (network) {
    case "instagram":
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" /></svg>;
    case "youtube":
      return <svg {...common}><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor" /></svg>;
    case "facebook":
      return <svg {...common}><path d="M14 8.5h2.5V5H14a3.5 3.5 0 0 0-3.5 3.5V11H8v3.5h2.5V21H14v-6.5h2.5L17 11h-3V8.5a.5.5 0 0 1 .5-.5z" /></svg>;
    case "whatsapp":
      return <svg {...common}><path d="M4 20l1.2-4A8 8 0 1 1 8 18.8z" /><path d="M9.2 8.8c.3 2.2 2.2 4.2 4.6 5l1.2-1.2-1.8-.9-.8.6a4 4 0 0 1-1.7-1.7l.6-.8-.9-1.8z" fill="currentColor" stroke="none" /></svg>;
  }
}
