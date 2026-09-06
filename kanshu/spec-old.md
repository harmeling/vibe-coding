# Revised Project Specification: Kanshū (監守)

## 🎯 Vision

A non-intrusive Go game recorder using a laptop’s built-in webcam. The system transforms a side-angle view into a top-down digital record, tracks moves in real-time, and exports the game to SGF format.

## 🛠 Technical Constraints

* **Camera:** Side-angle perspective (laptop sitting on the table next to the board).
* **Detection Method:** Grid-based intensity sampling (not circle detection) to account for perspective distortion and shadows.
* **State Logic:** Must distinguish between a "hand move" (temporary occlusion) and a "stone placement" (permanent state change).

---

## 📋 Implementation Phases

### Phase 1: Perspective Calibration (`calibrate.py`)

* **Input:** Live webcam feed.
* **Feature:** Interactive 4-point selection. The user clicks the four corner intersections of the Go board (, , , ).
* **Processing:** Use `cv2.getPerspectiveTransform` and `cv2.warpPerspective` to generate a "Top-Down"  pixel view.
* **Output:** Save the transformation matrix to `config.json` so calibration is only needed once per session.

### Phase 2: The Grid Engine (`detector.py`)

* **Logic:** Divide the  warped image into a  grid.
* **Sampling:** For each intersection, sample a  pixel area at the center.
* **Classification:**
* Compare the average  / Grayscale value against a "baseline" (empty board).
* Thresholds: `Luminance > High` = White Stone; `Luminance < Low` = Black Stone; `Baseline +/- Alpha` = Empty.


* **Stability Filter:** A change is only registered if the intersection state remains identical for 5 consecutive frames (prevents hand-flicker interference).

### Phase 3: Game Logic & SGF (`engine.py`)

* **Board State:** Maintain a 2D NumPy array representing the  board.
* **Move Validation:**
* If `Internal[x][y] == Empty` AND `Visual[x][y] == Stone`, trigger **Move Placement**.
* If `Internal[x][y] == Stone` AND `Visual[x][y] == Empty`, trigger **Capture/Removal**.


* **SGF Export:** Use the `sgfmill` library to append moves. Include a "Save" function that writes `game.sgf` whenever the state changes.

### Phase 4: Visual Overlay (`main.py` + `ui.py`)

* **Display:** A Pygame window showing two views:
1. The live de-warped board.
2. A clean digital board with numbered stones.


* **HUD:** Display "Current Turn," "Last Move," and "Total Captures."
* **Audio:** (Optional) Play a `click.wav` sound when a move is successfully recorded.

---

## 🤖 Instructions for the Agent (Prompt)

> "Act as an expert Python Computer Vision Engineer. Using the provided `spec.md`, build Project Kanshū.
> **Priority 1:** Ensure the perspective warping is rock-solid. Use `cv2.setMouseCallback` for the calibration step.
> **Priority 2:** For stone detection, do not use `HoughCircles`. Use the grid-sampling method described in Phase 2 to ensure reliability under varying light.
> **Priority 3:** Implement a 'debouncing' logic so that hands moving over the board don't trigger false moves.
> Start by creating a project directory and implementing Phase 1 (Calibration)."

