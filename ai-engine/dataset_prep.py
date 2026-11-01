import os
import yaml
import cv2
import numpy as np
import random
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset"

def generate_classroom_training_data(num_train: int = 60, num_val: int = 15):
    """
    Generates an augmented classroom human detection dataset in standard YOLO format.
    Includes seated students, standing professors, varying lighting, and desk occlusions.
    """
    print(f"Generating classroom human availability dataset in {DATASET_DIR}...")
    
    train_img_dir = DATASET_DIR / "images" / "train"
    val_img_dir = DATASET_DIR / "images" / "val"
    train_lbl_dir = DATASET_DIR / "labels" / "train"
    val_lbl_dir = DATASET_DIR / "labels" / "val"

    for d in [train_img_dir, val_img_dir, train_lbl_dir, val_lbl_dir]:
        d.mkdir(parents=True, exist_ok=True)

    def create_sample(split: str, idx: int):
        width, height = 640, 480
        # Realistic classroom background variations (dark tech room, light classroom, warm wood tone)
        bg_choice = random.choice(["slate", "light", "wood"])
        if bg_choice == "slate":
            base_color = (25, 30, 40)
        elif bg_choice == "light":
            base_color = (210, 215, 220)
        else:
            base_color = (60, 80, 110)

        img = np.full((height, width, 3), base_color, dtype=np.uint8)

        # Add classroom features (blackboard, windows, desks)
        cv2.rectangle(img, (120, 20), (520, 120), (30, 40, 30), -1)  # Board
        cv2.rectangle(img, (120, 20), (520, 120), (80, 90, 80), 2)

        # Desks in foreground
        cv2.rectangle(img, (50, 300), (250, 420), (50, 60, 75), -1)
        cv2.rectangle(img, (380, 300), (580, 420), (50, 60, 75), -1)

        # Randomize number of occupants (0 to 4)
        num_humans = random.randint(0, 4)
        labels = []

        for h_idx in range(num_humans):
            # Standing or seated
            is_seated = random.choice([True, False])
            
            if is_seated:
                # Seated student behind desk
                bx = random.randint(80, 500)
                by = random.randint(220, 310)
                bw = random.randint(60, 95)
                bh = random.randint(100, 140)
            else:
                # Standing person
                bx = random.randint(140, 460)
                by = random.randint(140, 250)
                bw = random.randint(70, 110)
                bh = random.randint(180, 250)

            # Ensure inside frame
            bx = max(10, min(bx, width - bw - 10))
            by = max(10, min(by, height - bh - 10))

            # Draw person silhouette
            center_x = bx + bw // 2
            head_y = by + bh // 5
            head_r = bw // 3
            body_y = by + bh // 2
            
            skin_tones = [(140, 180, 220), (90, 130, 180), (60, 90, 140)]
            cloth_colors = [(180, 50, 50), (40, 120, 180), (50, 160, 70), (40, 40, 40)]
            
            # Torso
            cv2.ellipse(img, (center_x, body_y), (bw // 2, bh // 3), 0, 0, 360, random.choice(cloth_colors), -1)
            # Head
            cv2.circle(img, (center_x, head_y), head_r, random.choice(skin_tones), -1)

            # YOLO Format: class x_center y_center width height (normalized 0 to 1)
            x_center = (bx + bw / 2.0) / width
            y_center = (by + bh / 2.0) / height
            norm_w = bw / width
            norm_h = bh / height
            labels.append(f"0 {x_center:.6f} {y_center:.6f} {norm_w:.6f} {norm_h:.6f}")

        # Add camera noise and lighting variation
        noise = np.random.normal(0, random.randint(2, 10), img.shape).astype(np.int16)
        img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

        # Save files
        img_dest = (train_img_dir if split == "train" else val_img_dir) / f"classroom_{idx:04d}.jpg"
        lbl_dest = (train_lbl_dir if split == "train" else val_lbl_dir) / f"classroom_{idx:04d}.txt"

        cv2.imwrite(str(img_dest), img)
        with open(lbl_dest, "w") as lf:
            lf.write("\n".join(labels))

    # Generate Train Split
    for i in range(num_train):
        create_sample("train", i)

    # Generate Val Split
    for i in range(num_val):
        create_sample("val", i)

    # Create dataset.yaml
    yaml_content = {
        "path": str(DATASET_DIR.resolve()),
        "train": "images/train",
        "val": "images/val",
        "names": {
            0: "person"
        }
    }

    yaml_file = DATASET_DIR / "dataset.yaml"
    with open(yaml_file, "w") as yf:
        yaml.dump(yaml_content, yf)

    print(f"Dataset generated successfully! {num_train} train images, {num_val} val images.")
    print(f"YAML config created at: {yaml_file}")
    return str(yaml_file)

if __name__ == "__main__":
    generate_classroom_training_data()
