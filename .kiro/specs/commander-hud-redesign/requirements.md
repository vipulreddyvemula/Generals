# Requirements Document

## Introduction

The Commander HUD Redesign transforms the existing prototype-quality Commander Panel into a polished, competitive esports-style HUD. It introduces two distinct challenge tracks — Math (solved in-game) and Codeforces (solved externally) — alongside a server-authoritative Energy system and a trimmed ability set (Scout, Reinforce, Airstrike only). The chat panel is moved to a compact floating button so the battlefield remains the dominant visual element at all times. All game logic remains server-authoritative; the client is purely presentational.

This feature builds on the existing codebase: `server/src/lib/commander/math-generator.ts` (hard-coded problem pool + `MathGenerator` class), `server/src/server.ts` socket handlers (`request_challenge`, `submit_challenge`, `activate_ability`), and `client/components/game/CommanderPanel.tsx` / `GameContext`.

---

## Glossary

- **HUD**: Heads-Up Display — the in-game overlay that shows Energy, challenges, and abilities.
- **Commander_Panel**: The React component and server logic that together deliver the Commander HUD experience.
- **Energy**: A 0–100 integer resource owned by each player, stored and mutated exclusively server-side.
- **Math_Challenge**: A pre-authored arithmetic or logic question served from the server's hard-coded pool; answered inside the game UI.
- **CF_Challenge**: A Codeforces competitive-programming problem assigned by the server; solved on the Codeforces website externally.
- **CF_Problem_Catalogue**: A static, curated JSON/TS file embedded in the server codebase that lists beginner-friendly Codeforces problems (≤800 rating, Div. 2 A-level).
- **Verification_Queue**: A server-side sequential queue that dispatches calls to the Codeforces `user.status` API one at a time to respect rate limits.
- **Ability**: A game-effect action (Scout, Reinforce, Airstrike) that costs Energy and is activated through the HUD.
- **Chat_Popover**: A compact floating chat panel, replacing the full-screen `ChatBox` component during active gameplay.
- **Chat_Button**: A circular floating icon button (💬) that toggles the `Chat_Popover` open or closed.
- **Socket_IO**: The WebSocket transport used for real-time communication between client and server.
- **CF_Handle**: A player's Codeforces username, stored server-side and used for submission verification.
- **challengeIssuedAt**: A server-side timestamp recording when a CF or Math challenge was assigned, stored as both game turn number and Unix milliseconds.
- **rewardedSubmissionId**: The Codeforces submission ID that triggered a successful reward, stored to guarantee idempotency.

---

## Requirements

### Requirement 1: Chat Relocation

**User Story:** As a player, I want chat to stay out of the way during gameplay, so that the battlefield occupies maximum screen space.

#### Acceptance Criteria

1. WHEN a game is in the `gameRealStarted` state, THE Commander_Panel SHALL hide the full-width `ChatBox` component and render a `Chat_Button` in its place.
2. THE `Chat_Button` SHALL be a circular floating button positioned at the bottom-left of the game viewport, with a chat bubble icon (💬), and SHALL NOT obscure game map tiles or action controls.
3. WHEN the `Chat_Button` is clicked, THE Commander_Panel SHALL render the `Chat_Popover` overlaid above the game viewport such that the game map and action controls remain visible within the viewport.
4. THE `Chat_Popover` SHALL preserve all existing chat functionality: displaying message history, accepting player text input, and emitting `player_message` via Socket_IO on Enter or send.
5. WHEN the `Chat_Popover` is open and the player clicks outside it or presses Escape, THE Commander_Panel SHALL close the `Chat_Popover`.
6. IF a new chat message from another player arrives while the `Chat_Popover` is closed, THE `Chat_Button` SHALL display an unread-message badge incrementing by one per message, capped at display value 99+.
7. WHILE the `Chat_Popover` is open, THE `Chat_Button` SHALL NOT increment the unread-message badge for incoming messages.
8. WHEN the `Chat_Popover` is opened, THE Commander_Panel SHALL reset the unread-message badge to zero.

---

### Requirement 2: Commander HUD Layout

**User Story:** As a player, I want a polished, information-dense right-side HUD, so that I can monitor Energy, manage challenges, and activate abilities without losing focus on the battlefield.

#### Acceptance Criteria

1. THE Commander_Panel SHALL be rendered as a fixed-width (320 px) panel anchored to the right edge of the game viewport with 0 px horizontal offset, vertically centred within the viewport, and SHALL NOT overlap the game map area.
2. THE Commander_Panel SHALL use a dark, semi-transparent background with a 1 px cyan border and backdrop blur effect.
3. THE Commander_Panel SHALL render the following sections in order from top to bottom: header, Energy bar, Math Challenge section, Codeforces Challenge section, Abilities section.
4. IF the viewport height is less than 720 px, THEN THE Commander_Panel SHALL become vertically scrollable and top-anchored so that all sections remain accessible by scrolling.
5. THE Commander_Panel SHALL render at viewport widths of 1280 px, 1366 px, 1440 px, and 1920 px without horizontal overflow and without any section content being truncated or hidden.
6. IF a section is in an active state (challenge in progress or ability selected), THEN THE Commander_Panel SHALL apply a visible border highlight to that active section, with no border highlight applied to any non-active section.
7. IF multiple sections are simultaneously in an active state, THEN THE Commander_Panel SHALL apply a visible border highlight independently to each active section without affecting the appearance of non-active sections.

---

### Requirement 3: Energy Display

**User Story:** As a player, I want to see my current Energy level prominently, so that I can plan when to use abilities and request challenges.

#### Acceptance Criteria

1. THE Commander_Panel SHALL display a horizontal progress bar representing Energy as a fraction of the maximum value of 100.
2. THE Commander_Panel SHALL display the numeric Energy value next to the progress bar (format: `{current} / 100`).
3. WHEN Energy is 80 or above, THE Commander_Panel SHALL render the progress bar with a red-to-orange gradient.
4. WHEN Energy is below 80, THE Commander_Panel SHALL render the progress bar with a blue-to-cyan gradient.
5. WHEN the Energy value changes, THE Commander_Panel SHALL animate the progress bar with a CSS transition duration between 300 ms and 600 ms inclusive.
6. WHEN the server emits `energy_update` with a new value within the range 0 to 100 inclusive, THE Commander_Panel SHALL update the displayed Energy without requiring a page reload.
7. IF the server emits `energy_update` with a value outside the range 0 to 100, THEN THE Commander_Panel SHALL clamp the displayed Energy to the nearest bound (0 or 100) and update the progress bar accordingly.
8. WHEN the Commander_Panel first renders before any `energy_update` event is received, THE Commander_Panel SHALL display Energy as 0 / 100 with the progress bar at 0% width using the blue-to-cyan gradient.

---

### Requirement 4: Math Challenge Flow — Client

**User Story:** As a player, I want to request and answer Math challenges in the HUD, so that I can earn Energy and troops quickly without leaving the game.

#### Acceptance Criteria

1. WHILE no Math_Challenge is active and the player is not on cooldown, THE Commander_Panel SHALL display a "REQUEST CHALLENGE" button in the Math section with a pulsing animation.
2. WHEN the "REQUEST CHALLENGE" button is clicked, THE Commander_Panel SHALL emit `request_math_challenge` via Socket_IO.
3. WHEN the server emits `math_challenge`, THE Commander_Panel SHALL replace the button with an inline challenge card showing: domain label, question text, reward preview, and a text input with a submit button.
4. WHEN the challenge card is displayed, THE Commander_Panel SHALL auto-focus the answer input field.
5. WHEN the player submits an answer (via Enter or the submit button), THE Commander_Panel SHALL emit `submit_math_answer` with the challenge ID and the trimmed answer string.
6. IF the player attempts to submit an empty or whitespace-only answer, THEN THE Commander_Panel SHALL NOT emit `submit_math_answer` and SHALL display an inline validation message prompting the player to enter an answer.
7. WHEN the server emits `math_result` with `correct: true`, THE Commander_Panel SHALL display a success flash animation and show the Energy and troop reward amounts for 3 seconds, then transition to the cooldown state (criterion 9).
8. WHEN the server emits `math_result` with `correct: false`, THE Commander_Panel SHALL display a shake animation on the challenge card and show an "Incorrect" message for 3 seconds, then transition to the cooldown state (criterion 9).
9. WHILE the player is on cooldown, THE Commander_Panel SHALL display a "RECHARGING…" label in place of the button and SHALL NOT allow emitting a new `request_math_challenge`.
10. WHEN the server emits `challenge_expired`, THE Commander_Panel SHALL dismiss the challenge card and display a neutral "Challenge expired" message for 2 seconds, then transition to the cooldown state (criterion 9).
11. WHEN the server emits `challenge_error`, THE Commander_Panel SHALL display the error message string received from the server for 3 seconds, then return to the idle state (criterion 1).

---

### Requirement 5: Math Challenge Flow — Server

**User Story:** As a server, I want to own all Math challenge assignment and validation, so that players cannot manipulate rewards.

#### Acceptance Criteria

1. WHEN the server receives `request_math_challenge` from a socket, THE Server SHALL verify the game is active, the player is alive and not a spectator, no Math_Challenge is already active for that player, and the current turn is past `challengeCooldownUntilTurn`.
2. IF any guard in criterion 1 fails, THEN THE Server SHALL emit `challenge_error` to that socket with a descriptive message and SHALL NOT assign a new challenge.
3. WHEN all guards pass, THE Server SHALL select a problem from the Math_Problem_Pool, assign a UUID, record `challengeIssuedAt` as the current game turn, and emit `math_challenge` to the socket containing: `{ id, domain, question, rewardEnergy, rewardTroops, expiresTurn }` — never including `correctAnswer`.
4. IF the server receives `submit_math_answer` with an ID that does not match the player's active challenge or with a current turn that exceeds `expiresTurn`, THEN THE Server SHALL emit `challenge_error` with a descriptive reason and SHALL NOT process the answer.
5. IF the submitted answer matches the canonical answer (case-insensitive, stripped of leading/trailing whitespace and commas), THEN THE Server SHALL increment the player's Energy by `rewardEnergy` (capped at 100), add `rewardTroops` to the player's king tile, set `challengeCooldownUntilTurn`, clear `activeChallenge`, and emit `math_result` with `{ correct: true, energy, rewardEnergy, rewardTroops }`.
6. IF the submitted answer does not match the canonical answer, THEN THE Server SHALL set `challengeCooldownUntilTurn`, clear `activeChallenge`, and emit `math_result` with `{ correct: false }`.
7. WHEN a Math_Challenge's `expiresTurn` is reached during the game loop tick, THE Server SHALL clear the player's `activeChallenge`, set `challengeCooldownUntilTurn`, and emit `challenge_expired` to that socket.
8. THE Server SHALL use the reward schedule: Easy → +1 Energy +1 troop, Medium → +2 Energy +2 troops, Hard → +4 Energy +3 troops, Expert → +5 Energy +5 troops.
9. THE Server SHALL make challenge cooldown duration configurable via a server-side constant (default: 6 turns).

---

### Requirement 6: Codeforces Problem Catalogue

**User Story:** As a developer, I want a curated local catalogue of beginner Codeforces problems, so that the server can assign problems without live API calls at selection time.

#### Acceptance Criteria

1. THE Server SHALL maintain a static `CF_Problem_Catalogue` as a TypeScript file embedded in `server/src/lib/commander/`.
2. THE `CF_Problem_Catalogue` SHALL contain at least 50 problems rated ≤ 800 from Codeforces Div. 2 contest A slots.
3. EACH entry in the `CF_Problem_Catalogue` SHALL include: `contestId` (number), `index` (string, e.g. `"A"`), `name` (string), `url` (string in the format `https://codeforces.com/problemset/problem/{contestId}/{index}`), and `rating` (number ≤ 800).
4. THE Server SHALL provide a problem-assignment function that selects a problem from the catalogue that is NOT in the player's `solvedProblemIds` set; IF all problems are solved, THE Server SHALL assign any catalogue problem.

---

### Requirement 7: Codeforces Challenge Flow — Server

**User Story:** As a server, I want to assign Codeforces problems and verify submissions asynchronously, so that the game loop is never paused by external API calls.

#### Acceptance Criteria

1. WHEN the server receives `request_codeforces_challenge` from a socket, THE Server SHALL verify the game is active, the player is alive, no CF_Challenge is active, and the player has a registered `CF_Handle`; IF any guard fails, THE Server SHALL emit `challenge_error` with a reason value from the set: `game_not_active`, `player_dead`, `challenge_active`, `no_cf_handle`.
2. WHEN all guards pass, THE Server SHALL select a problem from the `CF_Problem_Catalogue` per Requirement 6, record `challengeIssuedAt` as both the current game turn number and the current Unix timestamp in milliseconds, set `expiresTurn` to `challengeIssuedAt.turn + 10`, and emit `codeforces_challenge` to the socket with `{ id, contestId, index, name, url, reward: 50, expiresTurn }`.
3. WHEN the server receives `verify_codeforces_solution` with `(challengeId)`, THE Server SHALL add a verification job to the `Verification_Queue` and immediately emit `codeforces_verification_pending` to the socket — the game loop SHALL continue without waiting for the job to complete.
4. THE `Verification_Queue` SHALL process one job at a time, enforcing a minimum inter-request delay of 2 seconds to respect Codeforces API rate limits.
5. WHEN the `Verification_Queue` processes a job, THE Server SHALL call the Codeforces `user.status` API for the player's `CF_Handle`, filter for a submission matching `contestId` and `index` with verdict `OK`, and confirm the submission's `creationTimeSeconds` (converted to milliseconds) is after `challengeIssuedAt.timestampMs`.
6. IF a qualifying submission is found and the `rewardedSubmissionId` has NOT been recorded for this challenge, THEN THE Server SHALL grant +50 Energy (capped at 100), add +10 troops to the player's king tile, store `rewardedSubmissionId` to prevent duplicate rewards, and emit `codeforces_verification_result` with `{ success: true, energy, rewardEnergy: 50, rewardTroops: 10 }`.
7. IF no qualifying submission is found, THEN THE Server SHALL emit `codeforces_verification_result` with `{ success: false, reason }` where `reason` is one of: `no_submission`, `old_submission`, `rejected`, `already_rewarded`; and IF the challenge has not expired, THE Server SHALL include `can_retry: true` in the payload.
8. IF the Codeforces API call does not respond within 10 seconds or returns a network/rate-limit error, THEN THE Server SHALL emit `codeforces_verification_result` with `{ success: false, reason: 'api_unavailable' }` and SHALL NOT deduct Energy or modify player state.
9. WHEN a CF_Challenge's `expiresTurn` is reached during the game loop tick, THE Server SHALL clear the player's active CF challenge and emit `challenge_expired` to that socket.
10. THE Server SHALL store the player's `solvedProblemIds` for the duration of the socket connection lifetime, discarding it on disconnect, so already-solved problems are not reassigned within a session.
11. WHEN the server receives `set_cf_handle` from a socket, THE Server SHALL store the provided handle for that player if it is a non-empty string of 3–24 characters containing only alphanumeric characters, underscores, or hyphens.
12. IF the handle provided in `set_cf_handle` fails validation, THEN THE Server SHALL emit `challenge_error` with reason `invalid_cf_handle` and SHALL NOT store the handle.

---

### Requirement 8: Codeforces Challenge Flow — Client

**User Story:** As a player, I want a clear Codeforces challenge workflow in the HUD, so that I know exactly what to do, what state my verification is in, and whether I earned the reward.

#### Acceptance Criteria

1. THE Codeforces section of the Commander_Panel SHALL display one of the following states at all times: `AVAILABLE`, `WAITING_FOR_SUBMISSION`, `VERIFYING`, `ACCEPTED`, `NOT_ACCEPTED`, `EXPIRED`, or `ERROR`.
2. WHEN the state is `AVAILABLE`, THE Commander_Panel SHALL show a "GET CF CHALLENGE" button; WHEN the "GET CF CHALLENGE" button is clicked, THE Commander_Panel SHALL emit `request_codeforces_challenge` and transition to the `WAITING_FOR_SUBMISSION` state.
3. WHEN the state is `WAITING_FOR_SUBMISSION`, THE Commander_Panel SHALL show the problem name, a direct link to the Codeforces problem URL that opens in a new tab, and a "VERIFY SOLUTION" button.
4. WHEN the "VERIFY SOLUTION" button is clicked, THE Commander_Panel SHALL emit `verify_codeforces_solution` and transition to the `VERIFYING` state.
5. WHILE the state is `VERIFYING`, THE Commander_Panel SHALL display a loading animation and the label "Checking your submission…"; the game map SHALL remain fully interactive.
6. WHEN the server emits `codeforces_verification_result` with `success: true`, THE Commander_Panel SHALL transition to `ACCEPTED`, display the Energy reward amount and troop reward amount, and show a success animation for 4 seconds before returning to `AVAILABLE`.
7. WHEN the server emits `codeforces_verification_result` with `success: false`, THE Commander_Panel SHALL transition to `NOT_ACCEPTED`, display the failure reason provided by the server, and show a "RETRY VERIFY" button only if the server-provided result includes `can_retry: true`.
8. WHEN the server emits `challenge_expired`, THE Commander_Panel SHALL transition to `EXPIRED` regardless of current state and display "Challenge expired" for 3 seconds before returning to `AVAILABLE`.
9. WHILE the state is `ERROR`, THE Commander_Panel SHALL display the error string from the server and a "DISMISS" button; WHEN the "DISMISS" button is clicked, THE Commander_Panel SHALL transition to `AVAILABLE`.
10. IF the player has not yet set a `CF_Handle`, THEN THE Commander_Panel SHALL display a handle registration prompt in place of the "GET CF CHALLENGE" button.
11. WHEN the player submits a handle via the registration prompt, THE Commander_Panel SHALL emit `set_cf_handle` with the submitted handle value, where the handle value is between 3 and 24 characters in length.

---

### Requirement 9: Abilities — MVP Set

**User Story:** As a player, I want to activate Scout, Reinforce, and Airstrike abilities using Energy, so that I can gain tactical advantages.

#### Acceptance Criteria

1. THE Commander_Panel SHALL display exactly three ability buttons: Scout (20 Energy), Reinforce (40 Energy), Airstrike (60 Energy).
2. THE Commander_Panel SHALL NOT render or expose Blitz, Fortify, or Supply Surge buttons.
3. THE Server SHALL reject `activate_ability` requests for `Blitz`, `Fortify`, and `SupplySurge` by emitting `ability_failed` with the message `"Ability not available in this mode."` and SHALL NOT deduct Energy.
4. WHEN an ability button is clicked and the player's current Energy meets or exceeds the ability's cost, THE Commander_Panel SHALL enter target-selection mode for that ability.
5. WHILE in target-selection mode, THE Commander_Panel SHALL display the notice "Click a map tile to target {abilityName}" and a "Cancel" button; WHEN the player clicks a map tile, THE Commander_Panel SHALL emit `activate_ability` with the ability type and the selected tile coordinates and exit target-selection mode.
6. WHEN the "Cancel" button is clicked during target-selection mode, THE Commander_Panel SHALL exit target-selection mode without emitting `activate_ability`.
7. WHEN an ability button is clicked and the player's current Energy is less than the ability's cost, THE Commander_Panel SHALL render the button in a visually disabled state showing the required Energy cost and SHALL NOT emit `activate_ability`.
8. WHEN the server emits `ability_activated`, THE Commander_Panel SHALL display a success notification for no more than 3 seconds and update the displayed Energy.
9. WHEN the server emits `ability_failed`, THE Commander_Panel SHALL display the failure reason for 3 seconds.
10. THE Server SHALL validate that for Reinforce the target tile is owned by the activating player, for Airstrike the target tile is owned by an enemy player, and for Scout the target tile has been previously revealed to the activating player.
11. IF the target tile fails the ownership or visibility validation in criterion 10, THEN THE Server SHALL emit `ability_failed` with a descriptive reason and SHALL NOT deduct Energy.
12. IF the player attempts to activate Scout on a tile that has not been revealed, THEN THE Server SHALL emit `ability_failed` with reason `tile_not_revealed` and SHALL NOT deduct Energy.

---

### Requirement 10: Visual Design System

**User Story:** As a player, I want the entire HUD to feel intentional, modern, and competitive, so that the UI reinforces the game's esports identity.

#### Acceptance Criteria

1. THE Commander_Panel SHALL use the following colour roles: primary text `#ffffff`, secondary text `rgba(255,255,255,0.6)`, accent cyan `#00d4ff`, success `#4caf50`, error `#f44336`, warning `#ff9800`, and background `rgba(5,10,20,0.85)`.
2. THE Commander_Panel SHALL use uppercase text for all section headers with letter-spacing between 1 px and 3 px inclusive.
3. THE Commander_Panel SHALL apply animations (glow, pulse, shake) only to: an active challenge card, an ability button whose cost is affordable, and a feedback message region; THE Commander_Panel SHALL NOT apply continuous animation to idle elements.
4. THE Commander_Panel SHALL support keyboard navigation in the following tab order within the panel: Energy section (read-only), Math challenge controls, Codeforces challenge controls, Scout button, Reinforce button, Airstrike button; Tab and Shift+Tab SHALL cycle through interactive elements; Enter or Space SHALL activate the focused button; Escape SHALL cancel target-selection mode or close the Chat_Popover.
5. THE Commander_Panel SHALL provide an `aria-label` attribute on all icon-only buttons and a `role="status"` attribute on all feedback message regions.
6. WHEN rendered at 1280×720 px, THE Commander_Panel SHALL not clip, overflow horizontally, or overlap the central battlefield map area.

---

### Requirement 11: Socket.IO Event Contract

**User Story:** As a developer, I want a clear, stable event contract between client and server, so that both sides can be implemented and tested independently.

#### Acceptance Criteria

1. THE Client SHALL emit only these Commander-related events: `request_math_challenge`, `submit_math_answer`, `request_codeforces_challenge`, `verify_codeforces_solution`, `set_cf_handle`, `activate_ability`.
2. THE Server SHALL emit only these Commander-related events to individual sockets: `math_challenge`, `math_result`, `codeforces_challenge`, `codeforces_verification_pending`, `codeforces_verification_result`, `energy_update`, `challenge_expired`, `challenge_error`, `ability_activated`, `ability_failed`.
3. WHEN the server handles `challenge_issued`, `challenge_success`, or `challenge_failed` events from legacy code, THE Server SHALL map them to their new equivalents (`math_challenge` and `math_result` respectively) so that no client receives a legacy event name.
4. EACH event payload SHALL conform to a TypeScript interface defined in the shared `types.ts` file; no untyped `any` payloads are permitted for Commander events.
5. THE Server SHALL never include `correctAnswer` in any event payload sent to a client socket.
