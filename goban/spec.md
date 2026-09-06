# Project: Peer-to-Peer Physical Go Board

## 1. Vision
Create a minimalist, single-file web application that allows two players to play Go (Weiqi/Baduk) remotely. The app mimics a physical board: there are no rules enforced by code (no capture logic, no turn-taking). Players move stones freely via drag-and-drop.

## 2. Technical Stack
- **Single File:** Everything in `index.html` (CSS/JS included).
- **P2P Networking:** [PeerJS](https://peerjs.com/) via CDN.
- **QR Generation:** [qrcode.js](https://davidshimjs.github.io/qrcodejs/) via CDN.
- **Input:** Pointer Events API (supports Mouse + Touch).

## 3. UI/UX Requirements
- **The Board:** A square grid (lines, not squares). Default 9x9.
- **The Four Bowls:**
    1. **Infinite Black:** Dragging from here spawns a new black stone.
    2. **Infinite White:** Dragging from here spawns a new white stone.
    3. **Prisoner Black:** A bowl to drop "captured" black stones. Include a small counter incrementing/decrementing for every stone dropped here.
    4. **Prisoner White:** A bowl to drop "captured" white stones. Include a small counter incrementing/decrementing for every stone dropped/taken here.
- **Controls:** - A button to toggle a **QR Code** for the current URL.
    - A **Settings** menu to change board size (9x9, 13x13, 19x19).
    - A **Reset** button to clear the board and reset counters.
    - A **Look** button to cycle through different visual styles for the board and stones.

## 4. Connectivity Logic (The "Vibe" Flow)
- **Automatic Hosting:** On load, if no `?join=` param exists in the URL:
    - Initialize a PeerJS host.
    - Update the URL with `?join=[MY_ID]`.
    - **Auto-copy** the new URL to the clipboard.
    - Show a "Share link copied!" toast.
- **Automatic Joining:** If `?join=[ID]` exists:
    - Automatically connect to that ID as a guest.
- **Synchronization:**
    - Every stone must have a unique ID (e.g., `stone_171588...`).
    - Sync stone coordinates as **percentages (%)** of the board size to ensure cross-device compatibility (different screen sizes).
    - If a stone is moved into a "Prisoner Bowl," it should disappear from the board and increment the local and remote counter.

## 5. Visual Styles

### 5.1 Visual Style
- Minimalist, "Zen" aesthetic.
- Light wood-colored background for the board.
- Stones should have a subtle 3D shadow.
- Responsive design (must work on mobile portrait mode).

### 5.2 Visual Style (optional)
Board: Use a CSS repeating-linear-gradient to create a light wood grain texture. Lines should be thin, dark, and slightly transparent.
Stones: > - Must use radial gradients for a 3D convex look.
Black stones: Dark grey to black.
White stones: Bright white to light grey.
Dynamic Shadows: When a stone is actively being dragged (pointerdown), increase its box-shadow and transform: scale() to simulate the stone being lifted off the board.
Bowls: Use semi-transparent glass-morphism (backdrop-filter: blur) or a subtle inset shadow to make them look like recessed containers.


## example CSS:

/* Example of the "Nice Stone" CSS the agent should use */
.stone {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    cursor: grab;
    transition: transform 0.1s;
}

.stone.black {
    background: radial-gradient(circle at 30% 30%, #444, #000);
    box-shadow: 1px 2px 4px rgba(0,0,0,0.4);
}

.stone.white {
    background: radial-gradient(circle at 30% 30%, #fff, #ddd);
    box-shadow: 1px 2px 4px rgba(0,0,0,0.2);
}

.dragging {
    transform: scale(1.1); /* "Lifts" the stone */
    box-shadow: 5px 10px 20px rgba(0,0,0,0.3);
    cursor: grabbing;
}

## 6. More wishes

- no rounded courners anywhere
- the board should have the length of the shorter side of the screen
- the bowls should fill the remaining space on the longer side

## 7. More

- When clicking on the infinite bowls, a new stone shouldn't spawn in the center of the board, but rather at the position of the click/tap.
- stones that are dropped in the bowls should also be visible, when moved over the bowl area (like real bowls with stones in it)
- the prisoner bowls should only accept stones of the opposite color
- the infinite bowls should only spawn stones of their respective color

## 8. More

- the board should like a real go board have star points (hoshi) at the correct positions depending on the board size
- the lines should not extend to the edge of the board, but have a small margin, so that a stone can be placed fully on the board on crossing points without overlapping the edge
- e.g. for landscape mode: two bowls on the left (infinite black and infinite white) and one (rectangular) bowl on the right (prisoner with two counters, one for white and one for black)
- e.g. for portrait mode: same layout but bowls on top and bottom

## 9. More

- remove the look button and keep the default one and remove the dark style
- at the bottom and left edge the line is missing
- split the prisoner bowl into two bowls, one for black prisoners and one for white prisoners
- allow to drag stones from the prisoner bowls back onto the board, decrementing the respective counter

## 10. More

- make the prisoner bowls the same shape as the infinite bowls
- dragging into the prisoner bowls doesn't work yet.
- dragging back from the prisoner bowls should decrease the counter and be only possible if the counter is greater than zero
- the reset button should also reset the counters