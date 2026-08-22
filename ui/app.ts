import { App } from "@modelcontextprotocol/ext-apps";
import {
  SECOND_BRAIN_APP_CAPABILITIES,
  requestWorkspaceDisplayMode,
  type SecondBrainDisplayMode
} from "./display-mode.js";
import { getWorkspaceState } from "./workspace-state.js";
import { confirmationAction, learnerDescription } from "./workspace-actions.js";

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

const app = new App(
  { name: "พื้นที่ทำงาน Second Brain", version: "0.2.6" },
  SECOND_BRAIN_APP_CAPABILITIES,
  { strict: true, autoResize: true }
);

let displayMode: SecondBrainDisplayMode = "inline";

function applyDisplayMode(mode: SecondBrainDisplayMode): void {
  displayMode = mode;
  document.documentElement.dataset.displayMode = mode;
  const button = root.querySelector<HTMLButtonElement>("[data-mode-toggle]");
  if (button) button.textContent = mode === "fullscreen" ? "ย่อกลับเข้าแชต" : "เปิดเต็มหน้าจอ";
}

async function openFullscreen(): Promise<void> {
  const mode = await requestWorkspaceDisplayMode(
    { ...app.getHostContext(), displayMode },
    (params) => app.requestDisplayMode(params)
  );
  applyDisplayMode(mode);
}

async function toggleDisplayMode(): Promise<void> {
  const requestedMode = displayMode === "fullscreen" ? "inline" : "fullscreen";
  try {
    const result = await app.requestDisplayMode({ mode: requestedMode });
    applyDisplayMode(result.mode);
  } catch {
    showStatus("Claude ยังไม่รองรับการเปลี่ยนมุมมองในหน้าต่างนี้ครับ", true);
  }
}

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
    button.append(element("span", "option-description", learnerDescription(option.description)));
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

function render(view: View): void {
  root.replaceChildren();
  root.dataset.viewKind = view.kind;
  const workspace = getWorkspaceState(view.kind);

  const topbar = element("header", "topbar");
  const brand = element("div", "brand");
  brand.append(element("span", "brand-mark", "◆"), element("span", undefined, "Obsidian Second Brain"));
  const topbarActions = element("div", "topbar-actions");
  topbarActions.append(element("span", "ready-chip", "● พร้อมใช้งาน"));
  const modeToggle = element(
    "button",
    "mode-toggle",
    displayMode === "fullscreen" ? "ย่อกลับเข้าแชต" : "เปิดเต็มหน้าจอ"
  );
  modeToggle.type = "button";
  modeToggle.dataset.modeToggle = "true";
  modeToggle.addEventListener("click", () => void toggleDisplayMode());
  topbarActions.append(modeToggle);
  topbar.append(brand, topbarActions);
  root.append(topbar);

  const shell = element("div", "workspace-shell");
  const navigation = element("nav", "workflow-nav");
  navigation.append(element("span", "nav-label", "ขั้นตอนการทำงาน"));
  const steps = element("ol", "steps");
  workspace.steps.forEach((label, index) => {
    const item = element("li", index === workspace.currentIndex ? "active" : index < workspace.currentIndex ? "done" : "");
    item.append(element("span", "step-number", index < workspace.currentIndex ? "✓" : String(index + 1)), element("span", undefined, label));
    steps.append(item);
  });
  navigation.append(steps);

  const content = element("main", "workspace-content");
  const header = element("header", "content-header");
  header.append(element("span", "section-kicker", `ขั้นตอน ${workspace.currentIndex + 1} จาก ${workspace.steps.length}`));
  header.append(element("h1", undefined, view.title));
  if (view.subtitle) header.append(element("p", undefined, view.subtitle));
  content.append(header);

  const body = element("section", "content-body");
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
  content.append(body);

  const actions = element("section", "actions");
  if (view.kind === "confirmation") {
    actions.append(choiceButton(confirmationAction(), true));
    actions.append(choiceButton({ id: "revise", label: "กลับไปแก้", message: "ขอกลับไปแก้ Preview นี้" }));
  } else {
    for (const action of view.actions ?? []) actions.append(choiceButton(action, actions.childElementCount === 0));
  }
  actions.append(element("div", "status", ""));
  if (actions.childElementCount > 1) content.append(actions);

  const context = element("aside", "context-panel");
  context.append(element("span", "nav-label", "สถานะปัจจุบัน"));
  const contextCard = element("div", "context-card");
  contextCard.append(element("strong", undefined, workspace.currentLabel));
  contextCard.append(element("span", undefined, view.kind === "project_picker" ? `พบ ${view.options?.length ?? 0} ตัวเลือก` : "กำลังทำงานจากข้อมูลใน Vault"));
  context.append(contextCard);
  const safety = element("div", "safety-note");
  safety.append(element("span", "safety-icon", "✓"), element("span", undefined, view.kind === "confirmation" ? "รอการยืนยันก่อนบันทึก" : "ยังไม่มีการเขียนไฟล์"));
  context.append(safety);

  shell.append(navigation, content, context);
  root.append(shell);
  applyDisplayMode(displayMode);
}

app.ontoolresult = (params) => {
  const structured = params.structuredContent as { ok?: boolean; data?: { view?: View } } | undefined;
  if (structured?.ok && structured.data?.view) render(structured.data.view);
};

await app.connect();
applyDisplayMode(app.getHostContext()?.displayMode ?? "inline");
app.onhostcontextchanged = (context) => {
  if (context.displayMode) applyDisplayMode(context.displayMode);
};
void openFullscreen();
