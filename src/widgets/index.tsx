import { declareIndexPlugin, type ReactRNPlugin, SetRemType } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';

// Personal card-building utility. Disposable test commands operate ONLY on a
// fixture document this plugin created (tracked by Rem ID, never by name).
// The production command appends new sections/cards under one explicitly
// configured target document and never modifies or deletes existing content.

const ROOT = 'Instinct API Disposable Test';
const OWNER_KEY = 'ownedFixtureRootId';
const PAYLOAD_SETTING = 'card-payload';
const TARGET_SETTING = 'target-document-id';
const SAMPLE_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/320px-Placeholder_view_vector.svg.png';

async function text(plugin: ReactRNPlugin, value: string) {
  return plugin.richText.text(value).value();
}

async function plainText(plugin: ReactRNPlugin, richText: any) {
  return (await plugin.richText.toString(richText)).trim();
}

// Returns the fixture root Rem only if it was created by this plugin (its ID
// is the one recorded in synced storage) and it still carries the fixture
// name. Anything else is treated as not ours and is never touched.
async function getOwnedRoot(plugin: ReactRNPlugin) {
  const storedId = await plugin.storage.getSynced<string>(OWNER_KEY);
  if (!storedId) return undefined;
  const rem = await plugin.rem.findOne(storedId);
  if (!rem) {
    await plugin.storage.setSynced(OWNER_KEY, undefined);
    return undefined;
  }
  const name = await plainText(plugin, rem.text);
  if (name !== ROOT) {
    // The stored Rem no longer looks like our fixture. Do not touch it.
    await plugin.storage.setSynced(OWNER_KEY, undefined);
    return undefined;
  }
  return rem;
}

// True when some other document already uses the fixture name. We never
// delete or modify it; we only warn so the tester knows it is not ours.
async function foreignNameExists(plugin: ReactRNPlugin) {
  const found = await plugin.rem.findByName(await text(plugin, ROOT), null);
  if (!found) return false;
  const storedId = await plugin.storage.getSynced<string>(OWNER_KEY);
  return found._id !== storedId;
}

async function makeSection(plugin: ReactRNPlugin, parent: any, title: string) {
  const section = await plugin.rem.createRem();
  if (!section) throw new Error('Could not create section');
  await section.setText(await text(plugin, title));
  await section.setParent(parent);
  await section.setFontSize('H2');
  await section.setHighlightColor('Blue');
  return section;
}

async function makeCard(
  plugin: ReactRNPlugin,
  parent: any,
  spec: {
    type: string;
    front: string;
    back?: string | string[];
    items?: string[];
    cloze?: { start: number; end: number };
    imageUrl?: string;
  },
) {
  const rem = await plugin.rem.createRem();
  if (!rem) throw new Error('Could not create card Rem');

  let frontBuilder = plugin.richText.text(spec.front);
  if (spec.imageUrl) {
    frontBuilder = frontBuilder.newline().image(spec.imageUrl, 320, 180);
  }
  let front = await frontBuilder.value();
  if (spec.cloze) {
    front = await plugin.richText.applyTextFormatToRange(front, spec.cloze.start, spec.cloze.end, 'cloze');
  }
  await rem.setText(front);

  if (spec.back !== undefined) {
    const lines = Array.isArray(spec.back) ? spec.back : [spec.back];
    let backBuilder = plugin.richText.text(lines[0] ?? '');
    for (const line of lines.slice(1)) backBuilder = backBuilder.newline().text(line);
    await rem.setBackText(await backBuilder.value());
  }

  switch (spec.type) {
    case 'forward':
      await rem.setPracticeDirection('forward');
      break;
    case 'both':
      await rem.setPracticeDirection('both');
      break;
    case 'concept':
      await rem.setType(SetRemType.CONCEPT);
      await rem.setPracticeDirection('both');
      break;
    case 'list':
      await rem.setIsCardItem(true);
      break;
    case 'cloze':
      break;
    default:
      throw new Error(`Unsupported card type: ${spec.type}`);
  }

  await rem.setParent(parent);

  if (spec.type === 'list') {
    for (const itemText of spec.items ?? []) {
      const item = await plugin.rem.createRem();
      if (!item) throw new Error('Could not create list item');
      await item.setText(await text(plugin, itemText));
      await item.setParent(rem);
    }
  }
  return rem;
}

function validateCard(c: unknown, label: string) {
  if (typeof c !== 'object' || c === null) throw new Error(`${label}: not an object.`);
  const card = c as Record<string, unknown>;
  if (!['forward', 'both', 'concept', 'list', 'cloze'].includes(String(card.type)))
    throw new Error(`${label}: type must be forward, both, concept, list, or cloze.`);
  if (typeof card.front !== 'string' || !card.front)
    throw new Error(`${label}: front must be a non-empty string.`);
  if (card.type === 'list' && (!Array.isArray(card.items) || card.items.length === 0))
    throw new Error(`${label}: list cards need a non-empty items array.`);
  if (card.type === 'cloze') {
    const cloze = card.cloze as { start?: number; end?: number } | undefined;
    if (!cloze || typeof cloze.start !== 'number' || typeof cloze.end !== 'number')
      throw new Error(`${label}: cloze cards need cloze.start and cloze.end character offsets.`);
  }
}

function validatePayload(raw: unknown): any[] {
  if (!Array.isArray(raw)) throw new Error('Payload must be a JSON array of card specs.');
  raw.forEach((c, i) => validateCard(c, `Card ${i + 1}`));
  return raw as any[];
}

// Sections form: { "sections": [ { title, cards?, sections? }, ... ] }
function validateSectionedPayload(raw: unknown): any[] {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as any).sections))
    throw new Error('Payload must be { "sections": [ { "title": ..., "cards": [...], "sections": [...] } ] }.');
  const check = (s: any, path: string) => {
    if (typeof s !== 'object' || s === null || typeof s.title !== 'string' || !s.title)
      throw new Error(`${path}: section needs a non-empty title.`);
    (s.cards ?? []).forEach((c: unknown, i: number) => validateCard(c, `${path} card ${i + 1}`));
    (s.sections ?? []).forEach((sub: any, i: number) => check(sub, `${path} > section ${i + 1}`));
  };
  (raw as any).sections.forEach((s: any, i: number) => check(s, `Section ${i + 1}`));
  return (raw as any).sections;
}

async function readPayloadSetting(plugin: ReactRNPlugin) {
  const raw = await plugin.settings.getSetting<string>(PAYLOAD_SETTING);
  if (!raw || !raw.trim()) {
    await plugin.app.toast(`Paste a JSON card payload into the plugin setting "${PAYLOAD_SETTING}" first.`);
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    await plugin.app.toast(`Payload is not valid JSON: ${(e as Error).message}`);
    return undefined;
  }
}

async function createDisposable(plugin: ReactRNPlugin) {
  // Idempotent recreate: remove only the fixture we own, by stored ID.
  const existing = await getOwnedRoot(plugin);
  if (existing) await existing.remove();
  if (await foreignNameExists(plugin)) {
    await plugin.app.toast(`A document named "${ROOT}" exists that this plugin did not create. It will not be touched.`);
  }

  const root = await plugin.rem.createRem();
  if (!root) throw new Error('Could not create disposable root');
  await root.setText(await text(plugin, ROOT));
  await root.setIsDocument(true);
  await root.setFontSize('H1');
  await plugin.storage.setSynced(OWNER_KEY, root._id);

  const section = await makeSection(plugin, root, 'Exact text: α β — “quotes” $50, MixedCase');

  await makeCard(plugin, section, { type: 'forward', front: 'Forward prompt?', back: ['Line one', 'Line two'] });
  await makeCard(plugin, section, { type: 'both', front: 'Bidirectional prompt', back: 'Bidirectional answer' });
  await makeCard(plugin, section, { type: 'concept', front: 'Concept', back: 'Descriptor' });
  await makeCard(plugin, section, { type: 'list', front: 'Multiline list', items: ['First item', 'Second item'] });
  await makeCard(plugin, section, { type: 'cloze', front: 'The tested phrase remains exact.', cloze: { start: 4, end: 17 } });
  await makeCard(plugin, section, { type: 'forward', front: 'Image prompt', back: 'Image answer', imageUrl: SAMPLE_IMAGE });

  await plugin.app.toast('Disposable API test fixture created. Production untouched.');
}

async function createFromPayload(plugin: ReactRNPlugin) {
  const parsed = await readPayloadSetting(plugin);
  if (parsed === undefined) return;
  let specs: any[];
  try {
    specs = validatePayload(parsed);
  } catch (e) {
    await plugin.app.toast(`Payload error: ${(e as Error).message}`);
    return;
  }

  let root = await getOwnedRoot(plugin);
  if (!root) {
    root = await plugin.rem.createRem();
    if (!root) throw new Error('Could not create disposable root');
    await root.setText(await text(plugin, ROOT));
    await root.setIsDocument(true);
    await root.setFontSize('H1');
    await plugin.storage.setSynced(OWNER_KEY, root._id);
  }

  const section = await makeSection(plugin, root, `Supplied payload (${new Date().toISOString()})`);
  for (const spec of specs) await makeCard(plugin, section, spec);
  await plugin.app.toast(`Built ${specs.length} cards from the supplied payload inside the disposable fixture.`);
}

// Finds a direct child of parent whose plain text equals title, or undefined.
async function findChildByTitle(plugin: ReactRNPlugin, parent: any, title: string) {
  const children = await parent.getChildren();
  for (const child of children ?? []) {
    if ((await plainText(plugin, child.text)) === title) return child;
  }
  return undefined;
}

// Appends sectioned cards under parent. A heading that already exists under
// the same parent is reused in place (never duplicated, never modified) and
// reported as skipped, so reruns are idempotent. Returns [created, skipped].
async function buildSections(plugin: ReactRNPlugin, parent: any, sections: any[], counts: { created: number; skipped: number; cards: number }) {
  for (const s of sections) {
    let node = await findChildByTitle(plugin, parent, s.title);
    if (node) {
      counts.skipped += 1;
    } else {
      node = await plugin.rem.createRem();
      if (!node) throw new Error(`Could not create section "${s.title}"`);
      await node.setText(await text(plugin, s.title));
      await node.setParent(parent);
      if (s.heading === 'H1' || s.heading === 'H2' || s.heading === 'H3') await node.setFontSize(s.heading);
      if (s.highlight) await node.setHighlightColor(s.highlight);
      counts.created += 1;
    }
    for (const spec of s.cards ?? []) {
      await makeCard(plugin, node, spec);
      counts.cards += 1;
    }
    if (s.sections?.length) await buildSections(plugin, node, s.sections, counts);
  }
}

async function buildIntoTarget(plugin: ReactRNPlugin) {
  const targetId = (await plugin.settings.getSetting<string>(TARGET_SETTING))?.trim();
  if (!targetId) {
    await plugin.app.toast(`Set the "${TARGET_SETTING}" plugin setting to the target document's Rem ID first.`);
    return;
  }
  const target = await plugin.rem.findOne(targetId);
  if (!target) {
    await plugin.app.toast(`No Rem found for "${TARGET_SETTING}" = ${targetId}. Nothing was created.`);
    return;
  }
  if (!(await target.isDocument())) {
    await plugin.app.toast(`Rem ${targetId} is not a document. Refusing to build. Nothing was created.`);
    return;
  }

  const parsed = await readPayloadSetting(plugin);
  if (parsed === undefined) return;
  let sections: any[];
  try {
    sections = validateSectionedPayload(parsed);
  } catch (e) {
    await plugin.app.toast(`Payload error: ${(e as Error).message}`);
    return;
  }

  const counts = { created: 0, skipped: 0, cards: 0 };
  await buildSections(plugin, target, sections, counts);
  await plugin.app.toast(
    `Build complete: ${counts.cards} cards, ${counts.created} new sections, ${counts.skipped} existing sections reused. Existing content was not modified.`,
  );
}

async function verifyReadback(plugin: ReactRNPlugin, root: any, storageKey: string, label: string) {
  const descendants = await root.allRemInDocumentOrPortal();
  const receipt = [] as string[];
  for (const rem of descendants) {
    const front = await plugin.richText.toString(rem.text);
    const back = rem.backText ? await plugin.richText.toString(rem.backText) : '';
    const cards = await rem.getCards();
    receipt.push(`${front} | ${back} | cards=${cards.map((c: any) => JSON.stringify(c.type)).join(',')}`);
  }
  await plugin.storage.setSession(storageKey, receipt);
  await plugin.app.toast(`Verified ${descendants.length} Rems in ${label}. Receipt stored.`);
}

async function verifyDisposable(plugin: ReactRNPlugin) {
  const root = await getOwnedRoot(plugin);
  if (!root) throw new Error('No plugin-owned disposable fixture found.');
  await verifyReadback(plugin, root, 'lastVerificationReceipt', 'the disposable fixture');
}

async function verifyTarget(plugin: ReactRNPlugin) {
  const targetId = (await plugin.settings.getSetting<string>(TARGET_SETTING))?.trim();
  if (!targetId) {
    await plugin.app.toast(`Set the "${TARGET_SETTING}" plugin setting first.`);
    return;
  }
  const target = await plugin.rem.findOne(targetId);
  if (!target || !(await target.isDocument())) {
    await plugin.app.toast(`Target ${targetId} is not a document. Nothing to verify.`);
    return;
  }
  await verifyReadback(plugin, target, 'lastTargetVerificationReceipt', 'the target document');
}

async function deleteDisposable(plugin: ReactRNPlugin) {
  const root = await getOwnedRoot(plugin);
  if (!root) {
    await plugin.app.toast('Nothing deleted: no fixture created and owned by this plugin was found.');
    return;
  }
  await root.remove();
  await plugin.storage.setSynced(OWNER_KEY, undefined);
  await plugin.app.toast('Disposable API test fixture deleted. Only the plugin-owned fixture was removed.');
}

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerStringSetting({
    id: PAYLOAD_SETTING,
    title: 'Card payload (JSON)',
    description:
      'JSON card specs. "Create Cards From Supplied Payload" takes a plain array; "Build Into Target Document" takes { "sections": [ { "title", "cards": [...], "sections": [...] } ] }.',
    multiline: true,
    defaultValue: '',
  });
  await plugin.settings.registerStringSetting({
    id: TARGET_SETTING,
    title: 'Target document Rem ID',
    description:
      'Rem ID of the one document "Build Into Target Document" may append sections and cards to. The command refuses to run unless this names an existing document. Existing content is never modified or deleted.',
    multiline: false,
    defaultValue: '',
  });

  const commands = [
    { id: 'create-disposable', name: 'API Test: Create Disposable Fixture', action: () => createDisposable(plugin) },
    { id: 'create-from-payload', name: 'API Test: Create Cards From Supplied Payload', action: () => createFromPayload(plugin) },
    { id: 'verify-disposable', name: 'API Test: Verify Disposable Fixture', action: () => verifyDisposable(plugin) },
    { id: 'delete-disposable', name: 'API Test: Delete Disposable Fixture', action: () => deleteDisposable(plugin) },
    { id: 'build-into-target', name: 'API: Build Cards Into Target Document From Payload', action: () => buildIntoTarget(plugin) },
    { id: 'verify-target', name: 'API: Verify Target Document', action: () => verifyTarget(plugin) },
  ];
  for (const command of commands) {
    await plugin.app.registerCommand(command);
    await plugin.app.registerSidebarButton(command);
  }
}

async function onDeactivate(_: ReactRNPlugin) {}
declareIndexPlugin(onActivate, onDeactivate);
