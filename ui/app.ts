import { App } from "@modelcontextprotocol/ext-apps";

type Option = { id: string; label: string; description?: string; selected?: boolean; message: string };
type Action = { id: string; label: string; message: string };
type Source = { label: string; locator: string; notePath: string };
type View = {
  kind: "project_picker" | "scope_selector" | "intake_review" | "result_explorer" | "confirmation";
  title: string;
  subtitle?: string;
  reasoning?: string[];
  options?: Option[];
  advanced?: Option[];
  metrics?: Array<{ label: string; value: string }>;
  proposedNotes?: string[];
  warnings?: string[];
  summary?: string;
  sources?: Source[];
  actions?: Action[];
  previewId?: string;
  target?: string;
  changes?: string[];
};

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("missing app root");

const app = new App({ name: "Second Brain Workspace", version: "0.2.0" }, {}, { strict: true });

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendList(parent: HTMLElement, items: string[]): void {
  const list = element("ul");
  for (const item of items) list.append(element("li", undefined, item));
  parent.append(list);
}

async function sendChoice(message: string, button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  try {
    await app.sendMessage({ role: "user", content: [{ type: "text", text: message }] });
  } catch {
    button.disabled = false;
    showStatus("ส่งตัวเลือกไม่สำเร็จครับ ใช้ข้อความบนปุ่มตอบในแชตแทนได้ครับ", true);
  }
}

function choiceButton(option: Option | Action, primary = false): HTMLButtonElement {
  const button = element("button", primary ? "primary" : "");
  button.type = "button";
  button.append(document.createTextNode(option.label));
  if ("description" in option && option.description) {
    button.append(element("span", "option-description", option.description));
  }
  if ("selected" in option && option.selected) button.classList.add("selected");
  button.addEventListener("click", () => void sendChoice(option.message, button));
  return button;
}

function showStatus(message: string, error = false): void {
  const status = root.querySelector<HTMLElement>(".status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", error);
}

function renderMetrics(parent: HTMLElement, metrics: View["metrics"]): void {
  if (!metrics?.length) return;
  const grid = element("section", "metrics");
  for (const metric of metrics) {
    const card = element("div", "metric");
    card.append(element("strong", undefined, metric.value), element("span", undefined, metric.label));
    grid.append(card);
  }
  parent.append(grid);
}

function renderSources(parent: HTMLElement, sources: Source[]): void {
  if (!sources.length) return;
  const details = element("details");
  details.append(element("summary", undefined, `Sources (${sources.length})`));
  for (const source of sources) {
    const card = element("div", "source");
    card.append(
      element("strong", undefined, source.label),
      element("span", undefined, source.locator),
      element("small", undefined, source.notePath)
    );
    details.append(card);
  }
  parent.append(details);
}

async function confirmWrite(view: View, button: HTMLButtonElement): Promise<void> {
  if (!view.previewId) return;
  button.disabled = true;
  showStatus("กำลังบันทึกหลังยืนยัน…");
  try {
    const result = await app.callServerTool({
      name: "apply_obsidian_note_write",
      arguments: { preview_id: view.previewId, confirmation: "ยืนยันบันทึก" }
    });
    if (result.isError) {
      button.disabled = false;
      showStatus("บันทึกไม่สำเร็จครับ โปรดสร้าง Preview ใหม่ในแชตครับ", true);
      return;
    }
    showStatus("บันทึกเข้า Second Brain แล้วครับ");
  } catch {
    button.disabled = false;
    showStatus("เชื่อมต่อเครื่องมือไม่สำเร็จครับ Preview เดิมยังไม่ถูกบันทึก", true);
  }
}

function render(view: View): void {
  root.replaceChildren();
  const header = element("header", "panel");
  header.append(element("div", "eyebrow", "Second Brain Workspace"), element("h1", undefined, view.title));
  if (view.subtitle) header.append(element("p", undefined, view.subtitle));
  root.append(header);

  const body = element("section", "panel");
  if (view.reasoning?.length) appendList(body, view.reasoning);
  if (view.summary) body.append(element("p", undefined, view.summary));
  renderMetrics(body, view.metrics);
  if (view.proposedNotes?.length) {
    body.append(element("strong", undefined, "Knowledge Notes ที่จะสร้าง"));
    appendList(body, view.proposedNotes);
  }
  if (view.warnings?.length) {
    body.append(element("strong", undefined, "ตรวจสอบก่อนดำเนินการ"));
    appendList(body, view.warnings);
  }
  if (view.options?.length) {
    const choices = element("div", "choices");
    for (const option of view.options) choices.append(choiceButton(option));
    body.append(choices);
  }
  if (view.advanced?.length) {
    const details = element("details");
    details.append(element("summary", undefined, "ตัวเลือกเพิ่มเติม"));
    const choices = element("div", "choices");
    for (const option of view.advanced) choices.append(choiceButton(option));
    details.append(choices);
    body.append(details);
  }
  if (view.sources) renderSources(body, view.sources);
  if (view.changes?.length) appendList(body, view.changes);
  root.append(body);

  const actions = element("section", "panel actions");
  if (view.kind === "confirmation") {
    const confirm = element("button", "primary", "ยืนยันบันทึก");
    confirm.type = "button";
    confirm.addEventListener("click", () => void confirmWrite(view, confirm));
    actions.append(confirm);
    actions.append(choiceButton({ id: "revise", label: "กลับไปแก้", message: "ขอกลับไปแก้ Preview นี้" }));
  } else {
    for (const action of view.actions ?? []) actions.append(choiceButton(action, actions.childElementCount === 0));
  }
  actions.append(element("div", "status", ""));
  if (actions.childElementCount > 1) root.append(actions);
}

app.ontoolresult = (params) => {
  const structured = params.structuredContent as { ok?: boolean; data?: { view?: View } } | undefined;
  if (structured?.ok && structured.data?.view) render(structured.data.view);
};

await app.connect();
