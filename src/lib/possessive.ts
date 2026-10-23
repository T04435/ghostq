/** "Lorde's", but "Christine and the Queens'": a name ending in s takes only the apostrophe. */
export function possessive(name: string): string {
  return /s$/i.test(name.trim()) ? `${name.trim()}'` : `${name.trim()}'s`;
}
