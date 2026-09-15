import { declareIndexPlugin, type ReactRNPlugin, SetRemType } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';

const ROOT = 'Instinct API Disposable Test';
const SAMPLE_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/320px-Placeholder_view_vector.svg.png';

async function text(plugin: ReactRNPlugin, value: string) {
  return plugin.richText.text(value).value();
}

async function findRoot(plugin: ReactRNPlugin) {
  return plugin.rem.findByName(await text(plugin, ROOT), null);
}

async function createDisposable(plugin: ReactRNPlugin) {
  const existing = await findRoot(plugin);
  if (existing) await existing.remove();

  const root = await plugin.rem.createRem();
  if (!root) throw new Error('Could not create disposable root');
  await root.setText(await text(plugin, ROOT));
  await root.setIsDocument(true);
  await root.setFontSize('H1');

  const section = await plugin.rem.createRem();
  if (!section) throw new Error('Could not create section');
  await section.setText(await plugin.richText.text('Exact text: α β — “quotes” $50, MixedCase').value());
  await section.setParent(root);
  await section.setFontSize('H2');
  await section.setHighlightColor('Blue');

  const forward = await plugin.rem.createRem();
  if (!forward) throw new Error('Could not create forward card');
  await forward.setText(await text(plugin, 'Forward prompt?'));
  await forward.setBackText(await plugin.richText.text('Line one').newline().text('Line two').value());
  await forward.setPracticeDirection('forward');
  await forward.setParent(section);

  const reverse = await plugin.rem.createRem();
  if (!reverse) throw new Error('Could not create reverse card');
  await reverse.setText(await text(plugin, 'Bidirectional prompt'));
  await reverse.setBackText(await text(plugin, 'Bidirectional answer'));
  await reverse.setPracticeDirection('both');
  await reverse.setParent(section);

  const concept = await plugin.rem.createRem();
  if (!concept) throw new Error('Could not create concept card');
  await concept.setText(await text(plugin, 'Concept'));
  await concept.setBackText(await text(plugin, 'Descriptor'));
  await concept.setType(SetRemType.CONCEPT);
  await concept.setPracticeDirection('both');
  await concept.setParent(section);

  const list = await plugin.rem.createRem();
  if (!list) throw new Error('Could not create multiline card');
  await list.setText(await text(plugin, 'Multiline list'));
  await list.setIsCardItem(true);
  await list.setParent(section);
  for (const itemText of ['First item', 'Second item']) {
    const item = await plugin.rem.createRem();
    if (!item) throw new Error('Could not create list item');
    await item.setText(await text(plugin, itemText));
    await item.setParent(list);
  }

  const cloze = await plugin.rem.createRem();
  if (!cloze) throw new Error('Could not create cloze');
  const clozeBase = await plugin.richText.text('The tested phrase remains exact.').value();
  const clozeText = await plugin.richText.applyTextFormatToRange(clozeBase, 4, 17, 'cloze');
  await cloze.setText(clozeText);
  await cloze.setParent(section);

  const image = await plugin.rem.createRem();
  if (!image) throw new Error('Could not create image card');
  await image.setText(await plugin.richText.text('Image prompt').newline().image(SAMPLE_IMAGE, 320, 180).value());
  await image.setBackText(await text(plugin, 'Image answer'));
  await image.setPracticeDirection('forward');
  await image.setParent(section);

  await plugin.storage.setSession('disposableRootId', root._id);
  await plugin.app.toast('Disposable API test created. Production untouched.');
}

async function verifyDisposable(plugin: ReactRNPlugin) {
  const root = await findRoot(plugin);
  if (!root) throw new Error('Disposable root not found');
  const descendants = await root.allRemInDocumentOrPortal();
  const receipt = [] as string[];
  for (const rem of descendants) {
    const front = await plugin.richText.toString(rem.text);
    const back = rem.backText ? await plugin.richText.toString(rem.backText) : '';
    const cards = await rem.getCards();
    receipt.push(`${front} | ${back} | cards=${cards.map(c => JSON.stringify(c.type)).join(',')}`);
  }
  await plugin.storage.setSession('lastVerificationReceipt', receipt);
  await plugin.app.toast(`Verified ${descendants.length} disposable Rems. Receipt stored.`);
}

async function deleteDisposable(plugin: ReactRNPlugin) {
  const root = await findRoot(plugin);
  if (root) await root.remove();
  await plugin.app.toast('Disposable API test deleted.');
}

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.app.registerCommand({ id: 'create-disposable', name: 'API Test: Create Disposable Fixture', action: () => createDisposable(plugin) });
  await plugin.app.registerCommand({ id: 'verify-disposable', name: 'API Test: Verify Disposable Fixture', action: () => verifyDisposable(plugin) });
  await plugin.app.registerCommand({ id: 'delete-disposable', name: 'API Test: Delete Disposable Fixture', action: () => deleteDisposable(plugin) });
}

async function onDeactivate(_: ReactRNPlugin) {}
declareIndexPlugin(onActivate, onDeactivate);
