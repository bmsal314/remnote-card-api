# RemNote Card API

A personal RemNote utility for creating structured flashcards from locally
supplied JSON payloads. Intended for personal use only (`unlisted: true` in
the manifest); not a public developer utility.

## Commands

Every command is registered both in the omnibar and as a sidebar button, so
no keyboard shortcut is required.

Disposable test commands - these operate **only** on a disposable fixture
document (`Instinct API Disposable Test`) that the plugin itself created:

1. `API Test: Create Disposable Fixture` - builds a fixed structural fixture
   covering exact Unicode and punctuation, hierarchy, headings, color,
   forward and bidirectional cards, concept/descriptor, multiline list
   cards, cloze formatting, and image rich text.
2. `API Test: Create Cards From Supplied Payload` - builds cards from a JSON
   array pasted into the plugin's `card-payload` setting.
3. `API Test: Verify Disposable Fixture` - reads back every Rem inside the
   fixture (front, back, card types) and stores a verification receipt.
4. `API Test: Delete Disposable Fixture` - deletes the fixture.

Production commands:

5. `API: Build Cards Into Target Document From Payload` - appends sectioned
   cards under the one document named by the `target-document-id` setting.
6. `API: Verify Target Document` - reads back the target document's
   structure and stores a verification receipt.

## Safety

- The repository contains generic plugin code only: no study-guide content,
  credentials, or personal data.
- The plugin sends no data anywhere; payloads are supplied locally through
  the plugin's own settings page.
- Disposable ownership is tracked by the fixture's Rem ID in synced plugin
  storage, never by document name. Delete and recreate can never select a
  document by name, so no user document can be removed or modified by the
  test commands. If a document happens to share the fixture's name and was
  not created by this plugin, the plugin warns and leaves it untouched.
- The production build command is append-only: it refuses to run unless
  `target-document-id` names an existing document, reuses (never duplicates
  or modifies) sections that already exist, and never deletes anything.

## Payload formats

### Plain array (disposable `Create Cards From Supplied Payload`)

```json
[
  { "type": "forward", "front": "Question?", "back": "Answer" },
  { "type": "forward", "front": "Multi-line?", "back": ["Line one", "Line two"] },
  { "type": "both", "front": "Term", "back": "Definition" },
  { "type": "concept", "front": "Concept", "back": "Descriptor" },
  { "type": "list", "front": "Steps", "items": ["First", "Second"] },
  { "type": "cloze", "front": "The tested phrase remains exact.", "cloze": { "start": 4, "end": 17 } },
  { "type": "forward", "front": "Image?", "back": "Answer", "imageUrl": "https://example.com/img.png" }
]
```

### Sectioned object (`Build Into Target Document`)

```json
{
  "sections": [
    {
      "title": "Module 1",
      "heading": "H2",
      "highlight": "Blue",
      "sections": [
        { "title": "Topic", "cards": [ { "type": "forward", "front": "Q?", "back": "A" } ] }
      ]
    }
  ]
}
```

Sections nest (`sections` inside a section). `heading` may be `H1`, `H2`,
or `H3`; `highlight` is a RemNote highlight color. Both optional. A section
title that already exists directly under the same parent is reused in
place, so rerunning a build never duplicates structure.

## Card types

- `forward`: one-directional card. `both`: bidirectional card.
- `concept`: concept/descriptor pair (practiced both ways).
- `list`: multiline list card; `items` become the card's answer lines.
- `cloze`: `cloze.start`/`cloze.end` are character offsets into `front`.
- `imageUrl` (optional, any type): appends an image to the card front.
