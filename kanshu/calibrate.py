import json
import os
from typing import List, Tuple

import cv2
import numpy as np

WINDOW_NAME = "Kanshu Calibration"
WARP_WINDOW = "Top-Down"
DEFAULT_BOARD_SIZE = 800
CONFIG_PATH = "config.json"

Point = Tuple[int, int]


def order_points(pts: np.ndarray) -> np.ndarray:
    # Order: top-left, top-right, bottom-right, bottom-left
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)

    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def draw_points(frame: np.ndarray, points: List[Point]) -> None:
    for idx, (x, y) in enumerate(points, start=1):
        cv2.circle(frame, (x, y), 6, (0, 255, 0), -1)
        cv2.putText(
            frame,
            str(idx),
            (x + 8, y - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )
    if len(points) >= 2:
        for i in range(len(points) - 1):
            cv2.line(frame, points[i], points[i + 1], (0, 200, 200), 2)


class Calibrator:
    def __init__(self, camera_index: int = 0, board_size: int = DEFAULT_BOARD_SIZE) -> None:
        self.camera_index = camera_index
        self.board_size = board_size
        self.points: List[Point] = []
        self.latest_frame: np.ndarray | None = None
        self.capture = cv2.VideoCapture(self.camera_index)

        if not self.capture.isOpened():
            raise RuntimeError("Unable to open camera. Check permissions or camera index.")

    def on_mouse(self, event: int, x: int, y: int, _flags: int, _param: object) -> None:
        if event == cv2.EVENT_LBUTTONDOWN:
            if len(self.points) < 4:
                self.points.append((x, y))

    def compute_warp(self, frame: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        pts = np.array(self.points, dtype="float32")
        ordered = order_points(pts)

        dst = np.array(
            [
                [0, 0],
                [self.board_size - 1, 0],
                [self.board_size - 1, self.board_size - 1],
                [0, self.board_size - 1],
            ],
            dtype="float32",
        )
        matrix = cv2.getPerspectiveTransform(ordered, dst)
        warped = cv2.warpPerspective(frame, matrix, (self.board_size, self.board_size))
        return matrix, warped

    def save_config(self, matrix: np.ndarray) -> None:
        payload = {
            "matrix": matrix.tolist(),
            "board_size": self.board_size,
            "points": self.points,
        }
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

    def run(self) -> None:
        cv2.namedWindow(WINDOW_NAME)
        cv2.setMouseCallback(WINDOW_NAME, self.on_mouse)

        while True:
            ok, frame = self.capture.read()
            if not ok:
                print("Failed to read frame from camera.")
                break

            self.latest_frame = frame.copy()
            preview = frame.copy()
            draw_points(preview, self.points)

            cv2.putText(
                preview,
                "Click 4 board corners (intersection points). Press r to reset, s to save, q to quit.",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )

            if len(self.points) == 4:
                try:
                    matrix, warped = self.compute_warp(frame)
                    cv2.imshow(WARP_WINDOW, warped)
                except cv2.error:
                    pass

            cv2.imshow(WINDOW_NAME, preview)
            key = cv2.waitKey(1) & 0xFF

            if key == ord("q"):
                break
            if key == ord("r"):
                self.points.clear()
            if key == ord("s") and len(self.points) == 4:
                if self.latest_frame is not None:
                    matrix, _ = self.compute_warp(self.latest_frame)
                    self.save_config(matrix)
                    print(f"Saved calibration to {os.path.abspath(CONFIG_PATH)}")

        self.capture.release()
        cv2.destroyAllWindows()


def main() -> None:
    calibrator = Calibrator()
    calibrator.run()


if __name__ == "__main__":
    main()
