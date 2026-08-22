export type WikiLink = {
  rawTarget: string;
  target: string;
  heading?: string;
  block?: string;
  alias?: string;
  embed: boolean;
};

export function parseWikiLinks(content: string): WikiLink[] {
  const visible = maskCode(content);
  const links: WikiLink[] = [];
  const expression = /(!)?\[\[([^\]\n]+)\]\]/gu;
  for (const match of visible.matchAll(expression)) {
    const inside = match[2]!.trim();
    const separator = inside.indexOf("|");
    const rawTarget = (separator >= 0 ? inside.slice(0, separator) : inside).trim();
    const alias = separator >= 0 ? inside.slice(separator + 1).trim() : undefined;
    const parsed = splitSubpath(rawTarget);
    if (!parsed.target) continue;
    links.push({
      rawTarget,
      target: parsed.target,
      ...(parsed.heading ? { heading: parsed.heading } : {}),
      ...(parsed.block ? { block: parsed.block } : {}),
      ...(alias ? { alias } : {}),
      embed: Boolean(match[1])
    });
  }
  return links;
}

function splitSubpath(rawTarget: string): { target: string; heading?: string; block?: string } {
  const headingAt = rawTarget.indexOf("#");
  const blockAt = rawTarget.indexOf("^");
  if (headingAt >= 0 && (blockAt < 0 || headingAt < blockAt)) {
    return { target: rawTarget.slice(0, headingAt).trim(), heading: rawTarget.slice(headingAt + 1).trim() };
  }
  if (blockAt >= 0) {
    return { target: rawTarget.slice(0, blockAt).trim(), block: rawTarget.slice(blockAt + 1).trim() };
  }
  return { target: rawTarget.trim() };
}

function maskCode(content: string): string {
  const characters = [...content];
  let fenced = false;
  let inline = false;
  let index = 0;
  while (index < characters.length) {
    if (!inline && characters.slice(index, index + 3).join("") === "```") {
      fenced = !fenced;
      characters[index] = characters[index + 1] = characters[index + 2] = " ";
      index += 3;
      continue;
    }
    if (!fenced && characters[index] === "`") {
      inline = !inline;
      characters[index] = " ";
      index += 1;
      continue;
    }
    if (fenced || inline) characters[index] = characters[index] === "\n" ? "\n" : " ";
    index += 1;
  }
  return characters.join("");
}
