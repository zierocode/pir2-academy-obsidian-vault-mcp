export type ParsedWikilink = {
  raw: string;
  target: string;
  display?: string;
  heading?: string;
  block?: string;
  embed: boolean;
};

export function normalizeIndexedPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\/+|\/+$/gu, "").replace(/\/{2,}/gu, "/");
}

export function parseWikilinks(content: string): ParsedWikilink[] {
  const links: ParsedWikilink[] = [];
  const matcher = /(!?\[\[([^\]\n]+)\]\])/gu;

  for (const match of content.matchAll(matcher)) {
    const raw = match[1]!;
    const body = match[2]!.trim();
    const pipeAt = body.indexOf("|");
    const destination = (pipeAt === -1 ? body : body.slice(0, pipeAt)).trim();
    const display = pipeAt === -1 ? undefined : body.slice(pipeAt + 1).trim() || undefined;
    const fragmentAt = destination.indexOf("#");
    const target = (fragmentAt === -1 ? destination : destination.slice(0, fragmentAt)).trim();
    const fragment = fragmentAt === -1 ? undefined : destination.slice(fragmentAt + 1).trim();

    if (!target) continue;

    links.push({
      raw,
      target: normalizeIndexedPath(target),
      ...(display ? { display } : {}),
      ...(fragment?.startsWith("^") ? { block: fragment.slice(1) } : fragment ? { heading: fragment } : {}),
      embed: raw.startsWith("!")
    });
  }

  return links;
}
