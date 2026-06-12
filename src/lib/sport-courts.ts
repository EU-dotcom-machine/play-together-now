export const sportCourtImage: Record<string, string> = {
  Futebol: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=600&q=80",
  Futsal: "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=600&q=80",
  Basquete: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&q=80",
  Vôlei: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=600&q=80",
  "Vôlei de Praia": "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&q=80",
  "Beach Tennis": "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&q=80",
  Tênis: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=600&q=80",
  Padel: "https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?w=600&q=80",
  Natação: "https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=600&q=80",
  Corrida: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80",
  Ciclismo: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=600&q=80",
  Skate: "https://images.unsplash.com/photo-1547447134-cd3f5c716030?w=600&q=80",
  Surf: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=600&q=80",
  Handebol: "https://images.unsplash.com/photo-1613928686581-d7f6a1d2c7a3?w=600&q=80",
  Pickleball: "https://images.unsplash.com/photo-1686227733043-f22b8b9c6a6d?w=600&q=80",
  "MMA / Luta": "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=600&q=80",
  Golfe: "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=600&q=80",
  "Tênis de Mesa": "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=600&q=80",
  Badminton: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&q=80",
  CrossFit: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80",
  Yoga: "https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&q=80",
};

const DEFAULT_COURT =
  "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=80";

export function getCourtImage(sportName: string | null | undefined): string {
  if (!sportName) return DEFAULT_COURT;
  return sportCourtImage[sportName] ?? DEFAULT_COURT;
}
