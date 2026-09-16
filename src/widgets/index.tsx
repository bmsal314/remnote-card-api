import { declareIndexPlugin, type ReactRNPlugin, SetRemType } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';

// Personal testing utility. Every command operates ONLY on a disposable
// fixture document that this plugin itself created. Ownership is tracked by
// Rem ID in plugin-synced storage, never by document name, so a user's real
// document can never be selected, modified, or deleted by these commands.

const ROOT = 'Instinct API Disposable Test';
const OWNER_KEY = 'ownedFixtureRootId';
const PAYLOAD_SETTING = 'card-payload';
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

function validatePayload(raw: unknown): any[] {
  if (!Array.isArray(raw)) throw new Error('Payload must be a JSON array of card specs.');
  raw.forEach((c, i) => {
    if (typeof c !== 'object' || c === null) throw new Error(`Card ${i + 1}: not an object.`);
    const card = c as Record<string, unknown>;
    if (!['forward', 'both', 'concept', 'list', 'cloze'].includes(String(card.type)))
      throw new Error(`Card ${i + 1}: type must be forward, both, concept, list, or cloze.`);
    if (typeof card.front !== 'string' || !card.front)
      throw new Error(`Card ${i + 1}: front must be a non-empty string.`);
    if (card.type === 'list' && (!Array.isArray(card.items) || card.items.length === 0))
      throw new Error(`Card ${i + 1}: list cards need a non-empty items array.`);
    if (card.type === 'cloze') {
      const cloze = card.cloze as { start?: number; end?: number } | undefined;
      if (!cloze || typeof cloze.start !== 'number' || typeof cloze.end !== 'number')
        throw new Error(`Card ${i + 1}: cloze cards need cloze.start and cloze.end character offsets.`);
    }
  });
  return raw as any[];
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
  const raw = await plugin.settings.getSetting<string>(PAYLOAD_SETTING);
  if (!raw || !raw.trim()) {
    await plugin.app.toast(`Paste a JSON card payload into the plugin setting "${PAYLOAD_SETTING}" first.`);
    return;
  }
  let specs: any[];
  try {
    specs = validatePayload(JSON.parse(raw));
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

async function verifyDisposable(plugin: ReactRNPlugin) {
  const root = await getOwnedRoot(plugin);
  if (!root) throw new Error('No plugin-owned disposable fixture found.');
  const descendants = await root.allRemInDocumentOrPortal();
  const receipt = [] as string[];
  for (const rem of descendants) {
    const front = await plugin.richText.toString(rem.text);
    const back = rem.backText ? await plugin.richText.toString(rem.backText) : '';
    const cards = await rem.getCards();
    receipt.push(`${front} | ${back} | cards=${cards.map((c) => JSON.stringify(c.type)).join(',')}`);
  }
  await plugin.storage.setSession('lastVerificationReceipt', receipt);
  await plugin.app.toast(`Verified ${descendants.length} Rems in the disposable fixture. Receipt stored.`);
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
      'JSON array of card specs used by "API Test: Create Cards From Supplied Payload". Cards are built only inside the disposable fixture document owned by this plugin.',
    multiline: true,
    defaultValue: '',
  });
  await plugin.app.registerCommand({ id: 'create-disposable', name: 'API Test: Create Disposable Fixture', action: () => createDisposable(plugin) });
  await plugin.app.registerCommand({ id: 'create-from-payload', name: 'API Test: Create Cards From Supplied Payload', action: () => createFromPayload(plugin) });
  await plugin.app.registerCommand({ id: 'verify-disposable', name: 'API Test: Verify Disposable Fixture', action: () => verifyDisposable(plugin) });
  await plugin.app.registerCommand({ id: 'delete-disposable', name: 'API Test: Delete Disposable Fixture', action: () => deleteDisposable(plugin) });
}

async function onDeactivate(_: ReactRNPlugin) {}
declareIndexPlugin(onActivate, onDeactivate);
