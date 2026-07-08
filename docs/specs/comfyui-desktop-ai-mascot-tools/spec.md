Comfy UI 側に ComfyUI Desktop AI Mascot Tools というカスタムノードを追加しました

仕様は 下記の通りです
このノードを使った結果はを このフォルダに *.png, *.json として保存します

----

# AI Coding Assistant Instructions for ComfyUI-DesktopAiMascotTools

This document contains metadata, architecture details, and usage patterns to help external AI assistants (e.g., Cursor, GitHub Copilot) understand and work with this codebase.

---

## Codebase Purpose

This project is a ComfyUI Custom Node package (`custom_nodes/ComfyUI-DesktopAiMascotTools`) designed to detect face boundaries and key features (eyes, mouth, landmarks) from anime/illustration images and export the coordinates as a structured JSON file.
The primary use case is transferring these coordinate spaces to external rendering/animation platforms (e.g., PixiJS, Live2D) for real-time mesh deformation (morphing) and expression control.

---

## Directory Structure

```
.
├── .github/
│   └── copilot-instructions.md      # This file
├── __init__.py                      # Package entry point (ComfyUI mappings)
├── anime_face_detector_node.py      # Face & landmark detection logic
├── face_parts_visualizer_node.py    # Overlay visualization generator
├── save_face_parts_json_node.py     # JSON serialization & export node
├── requirements.txt                 # Dependencies
├── README.md                        # User guide
├── spec.md                          # Specifications
└── workflows/
    └── face_detection_api.json      # Pre-configured API workflow definition
```

---

## Custom Nodes Specification

### 1. `AnimeFaceDetectorNode`
Uses `anime-face-detector` (falling back to OpenCV Haar cascades if not installed) to extract landmarks.
- **Input:**
  - `image` (`IMAGE`, shape `[B, H, W, C]`)
- **Output:**
  - `face_bbox` (`DICT` containing `[x, y, w, h]`)
  - `left_eye_bbox` (`DICT` containing `[x, y, w, h]`)
  - `right_eye_bbox` (`DICT` containing `[x, y, w, h]`)
  - `mouth_bbox` (`DICT` containing `[x, y, w, h]`)
  - `landmarks` (`LIST` of `[x, y]` coordinates)

### 2. `FacePartsVisualizerNode`
Draws boundary boxes and keypoints on top of the original image for debugging.
- **Input:**
  - `image` (`IMAGE`), and all outputs from `AnimeFaceDetectorNode`
- **Output:**
  - `image` (`IMAGE` as a `[1, H, W, C]` torch float32 tensor scaled to `0.0 - 1.0`)

### 3. `SaveFacePartsJsonNode`
Saves the coordinates and raw resolution into a structured JSON file.
- **Input:**
  - `image` (`IMAGE`, used to get width and height)
  - `face_bbox`, `left_eye_bbox`, `right_eye_bbox`, `mouth_bbox` (`DICT`)
  - `landmarks` (`LIST`)
  - `filename_prefix` (`STRING`, default: `face_parts`)
  - `output_dir` (`STRING`, optional, defaults to ComfyUI's standard output directory)
- **Execution UI Hook:**
  - Returns `{"ui": {"json_file": [file_path]}}` which triggers a WebSocket broadcast payload from the ComfyUI API containing the file location.

---

## Target JSON Output Schema

When `SaveFacePartsJsonNode` runs, it writes a JSON file structured exactly like this:

```json
{
  "image_width": 1024,
  "image_height": 1024,
  "face_bbox": { "x": 100.0, "y": 150.0, "w": 300.0, "h": 300.0 },
  "left_eye_bbox": { "x": 150.0, "y": 200.0, "w": 50.0, "h": 40.0 },
  "right_eye_bbox": { "x": 250.0, "y": 200.0, "w": 50.0, "h": 40.0 },
  "mouth_bbox": { "x": 200.0, "y": 280.0, "w": 100.0, "h": 30.0 },
  "landmarks": [
    { "x": 100.0, "y": 120.0 },
    ...
  ]
}
```

### Landmark Indices (Total 28 points)
- `0 - 4`: Left Eyebrow
- `5 - 9`: Right Eyebrow
- `10 - 13`: Left Eye
- `14 - 17`: Right Eye
- `18 - 21`: Nose
- `22 - 27`: Mouth

---

## Interfacing from External Applications (PixiJS/Node.js)

### WebSocket / HTTP flow (A-type Integration)

1. Generate execution command via HTTP POST to `/prompt` using `workflows/face_detection_api.json`.
2. Connect to the WebSocket at `ws://localhost:8188/ws`.
3. Listen for the `"executed"` event:
   ```javascript
   ws.onmessage = (event) => {
       const msg = JSON.parse(event.data);
       if (msg.type === "executed" && msg.data.output.json_file) {
           const fullPath = msg.data.output.json_file[0];
           const filename = fullPath.replace(/^.*[\\/]/, '');
           
           // Fetch the contents via ComfyUI built-in view API
           fetch(`http://localhost:8188/view?filename=${filename}&type=output`)
               .then(res => res.json())
               .then(data => {
                   // Inject coordinates into PixiJS mesh nodes
               });
       }
   };
   ```


