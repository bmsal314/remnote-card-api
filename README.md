# RemNote Card API

A personal RemNote test utility for creating and verifying structured cards
from a locally supplied JSON payload. This plugin is intended for personal
testing only (`unlisted: true` in the manifest) and is not a public developer
utility.

## What it does

1. `API Test: Create Disposable Fixture` - builds a fixed structural fixture
   covering exact Unicode and punctuation, hierarchy, headings, color,
   forward and bidirectional cards, concept/descriptor, multiline list
   cards, cloze formatting, and image rich text.
2. `API Test: Create Cards From Supplied Payload` - builds cards from a JSON
   payload pasted into the plugin's `card-payload` setting.
3. `API Test: Verify Disposable Fixture` - reads back every Rem inside the
   fixture (front, back, card types) and stores a verification receipt.
4. `API Test: Delete Disposable Fixture` - deletes the fixture.

## Safety

- The repository contains generic plugin code only. It contains no
  study-guide content, credentials, or personal data.
- The plugin sends no data anywhere; the payload is supplied locally through
  the plugin's own settings page.
- Every command operates **only** on a fixture document that the plugin
  itself created. Ownership is tracked by the fixture's Rem ID in synced
  plugin storage, never by document name. Delete and recreate can never
  select a document by name, so no user document can be removed or modified
  by these commands. If a document happens to share the fixture's name and
  was not created by this plugin, the plugin warns and leaves it untouched.

## Payload format

Paste a JSON array into the `card-payload` plugin setting, then run
`API Test: Create Cards From Supplied Payload`:

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

- `forward`: one-directional card. `both`: bidirectional card.
- `concept`: concept/descriptor pair (practiced both ways).
- `list`: multiline list card; `items` become the card's answer lines.
- `cloze`: `cloze.start`/`cloze.end` are character offsets into `front`.
- `imageUrl` (optional, any type): appends an image to the card front.

Production card generation is intentionally absent until disposable
validation passes.
