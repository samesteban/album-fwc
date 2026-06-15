# Album Sharing Specification

## Purpose

Let authenticated users generate public share snapshots of their sticker collection and let any visitor view them via a short link — no authentication, no database queries.

## Requirements

### Requirement: Share Generation

The system MUST generate a public share snapshot when an authenticated user triggers it. The snapshot SHALL contain the user's display name and current `collectionState`, uploaded as JSON to Supabase Storage with a short alphanumeric ID (5-7 chars).

#### Scenario: Authenticated user generates share

- GIVEN the user is authenticated with a non-empty collection
- WHEN they click the share button
- THEN a JSON blob with `{ name, collectionState }` is uploaded to `album-shares/public/{id}.json`
- AND the system displays the resulting share URL `/album/{id}`

### Requirement: Share URL Copy

The system MUST provide a one-click mechanism to copy the generated share URL to the clipboard.

#### Scenario: User copies share URL

- GIVEN a share URL is displayed after generation
- WHEN the user clicks the copy button
- THEN the full URL is copied to the system clipboard
- AND a visual confirmation is shown

### Requirement: Public Album View

The system MUST render a public album page for `/album/{id}` showing pasted stickers grouped by section, using `SECTIONS_METADATA` and `buildInitialSections()`.

#### Scenario: Visitor views a valid share

- GIVEN a valid share ID exists in storage
- WHEN a visitor navigates to `/album/{id}`
- THEN the JSON is fetched from the public Storage URL
- AND pasted stickers are rendered organized by section

### Requirement: Missing Stickers View

The system MUST display which stickers are missing from the collection for each section.

#### Scenario: Missing stickers shown per section

- GIVEN a valid share with an incomplete collection
- WHEN the album page renders
- THEN each section shows placeholders for stickers not yet collected

### Requirement: Repeated Stickers Count

The system SHOULD display counts for stickers collected more than once, sorted by frequency, using `getTopRepeatedCards()`.

#### Scenario: Repeated stickers shown

- GIVEN a share with duplicate stickers
- WHEN the album page renders
- THEN repeated cards are listed with their count

### Requirement: Invalid Share ID

The system MUST display a graceful error message when the share ID is invalid, missing, or the JSON is corrupted.

#### Scenario: Invalid ID returns error

- GIVEN a non-existent or malformed share ID
- WHEN the visitor navigates to `/album/{id}`
- THEN the page shows "Álbum no encontrado" without crashing

#### Scenario: Corrupted JSON handled

- GIVEN a share ID whose stored JSON is unparseable
- WHEN the fetch completes but parsing fails
- THEN the page shows "Álbum no encontrado"

### Requirement: Empty Collection Guard

The system MUST disable share generation when the user's collection is empty (no stickers collected).

#### Scenario: Empty collection prevents share

- GIVEN the user is authenticated but has no collected stickers
- WHEN viewing the Dashboard
- THEN the share button is disabled or hidden

### Requirement: Loading State

The system MUST show a loading indicator while fetching the share data on the public album page.

#### Scenario: Loading during fetch

- GIVEN a visitor navigates to `/album/{id}`
- WHEN the JSON is being fetched from storage
- THEN a loading indicator is displayed

### Requirement: Unauthenticated Guard

The system MUST hide or disable the share button when the user is not authenticated.

#### Scenario: Logged-out user sees no share option

- GIVEN the user is not authenticated
- WHEN viewing the Dashboard
- THEN no share button is rendered

#### Scenario: Session expires returns to unauthenticated state

- GIVEN the user was authenticated but their session expires
- WHEN the Dashboard detects the auth state change
- THEN the share button is immediately hidden or disabled
