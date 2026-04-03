# Reptor: AI-Powered Personal Trainer

Reptor is a privacy-first mobile workout application that uses on-device computer vision to provide real-time posture correction.

## 📱 Tech Stack

- **Framework**: React Native, Expo
- **UI & Style**: Uniwind, React Native Reusables
- **Pose Estimation**: Blazepose / MoveNet on TFLite
- **Evaluation Logic**: [`@royng163/reptor-core`](https://github.com/royng163/reptor-core)

## 🏗 Architecture

Reptor follows a **Teacher-Student** knowledge distillation architecture:

1.  **Teacher (Offline)**: High-capacity Python models analyze complex temporal patterns to generate ground-truth quality scores and error labels.
2.  **Distillation**: These insights are converted into lightweight, interpretable rules (thresholds, weights) and a Tiny Scorer model.
3.  **Student (This App)**: Runs locally on the phone. It executes the distilled rules against real-time landmarks from Blazepose to provide instant feedback.

### Key Modules

- **Vision Pipeline**: Captures camera frames and runs Blazepose inference.
- **Rule Engine**: Consumes `rule_config.json` to check for errors (e.g., "Knees caving in").
- **Feedback UI**: Renders corrective cues overlaying the camera feed.

## 🛠 Getting Started

### Installation

```bash
# Install dependencies
yarn install

# Start the development server
yarn run dev
```

## 📂 Project Structure

```
reptor/
├── assets/               # Images and icons
├── app/                  # Expo Router file-based navigation
│   ├── (tabs)/           # Main app tabs (Workout, Profile)
│   ├── _layout.tsx       # Root layout
│   └── index.tsx         # Entry screen
├── components/           # Reusable UI components
│   └── ui/               # Generic buttons, cards
├── hooks/                # Custom React hooks
├── services/
│   ├── camera/           # Camera manager
│   └── evaluation/       # Workout posture correction
│       └── rules/        # Distilled rule_config.json
├── lib/                  # Utility functions and shared logic
├── README.md             # This file
└── package.json          # Project dependencies and scripts
```
