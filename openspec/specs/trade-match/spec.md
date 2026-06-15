# Trade Match Specification

## Purpose

Compare two album share snapshots to identify which cards each collector can trade and highlight direct swap opportunities.

## Requirements

### Requirement: Match Page Route

The system MUST render TradeMatchPage at `/match` with two ID inputs and a "Comparar" button. The Dashboard MUST link to this route.

#### Scenario: Navigate to match route

- GIVEN the user navigates to `/match`
- WHEN the route resolves
- THEN TradeMatchPage renders with "Tu ID" and "ID del otro álbum" inputs and a "Comparar" button
- AND the Dashboard includes a visible entry point to this route

### Requirement: User ID Auto-Fill

The system SHALL pre-fill "Tu ID" from `album_share_metadata` in localStorage and MUST allow manual override. If no stored ID exists, the user SHOULD be prompted to share their album first.

#### Scenario: ID exists in storage

- GIVEN `album_share_metadata` exists in localStorage
- WHEN TradeMatchPage renders
- THEN "Tu ID" is pre-filled automatically with the stored ID

#### Scenario: No stored ID

- GIVEN no `album_share_metadata` exists in localStorage
- WHEN TradeMatchPage renders
- THEN the user is prompted to share their album before comparing

### Requirement: Parallel Fetch

The system MUST fetch both album JSONs concurrently when the user clicks "Comparar" using `Promise.all`, and MUST show a loading indicator during fetch.

#### Scenario: Both fetches succeed

- GIVEN both IDs are valid album share identifiers
- WHEN the user clicks "Comparar"
- THEN both JSONs are fetched in parallel from their Storage URLs
- AND a loading spinner is displayed while fetching

#### Scenario: Invalid other ID

- GIVEN the other ID is invalid, expired, or returns a network error
- WHEN the user clicks "Comparar"
- THEN the system displays "Álbum no encontrado"

### Requirement: Trade Computation

The system MUST compute trade results via a pure function: a card goes to "Vos le das" if the user has duplicates (count > 1) and the other has none; to "Elx te da" if the other has duplicates and the user has none; and to "Match" if both conditions hold for the same card.

#### Scenario: All categories computed

- GIVEN both album states are loaded
- WHEN `computeTradeMatches()` executes
- THEN cards with count > 1 in one collection and count === 0 in the other are classified into the correct category
- AND cards where both sides have extras are classified as matches

### Requirement: Results Display

The system MUST display results in three sections — "Vos le das", "Elx te da", and "Matches 🎯" — each showing flag, section ID, card number, player name, and count. The Matches section SHALL be visually highlighted to indicate the best swap opportunity.

#### Scenario: Show results with matches

- GIVEN trade results have entries in all categories
- WHEN results render
- THEN each section shows its cards with flag, section ID, card number, player name, and count
- AND the "Matches 🎯" section is visually highlighted

#### Scenario: No matches found

- GIVEN no mutual swap opportunities exist
- WHEN results render
- THEN the "Matches 🎯" section shows a message indicating no direct matches

### Requirement: Edge Cases

The system MUST handle empty collections, self-comparison, and both-empty states with appropriate user-facing messages.

#### Scenario: Both collections empty

- GIVEN both albums have no cards
- WHEN results are computed
- THEN "Nada para intercambiar" is displayed

#### Scenario: Other collection empty

- GIVEN the other album has no cards
- WHEN results are computed
- THEN "Esta persona no tiene láminas registradas" is displayed

#### Scenario: Same ID in both fields

- GIVEN the user enters the same ID in both inputs
- WHEN they click "Comparar"
- THEN no matches are shown without error
- AND the system indicates self-comparison produces no trades
