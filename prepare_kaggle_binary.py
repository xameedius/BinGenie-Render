import shutil
from pathlib import Path

# 🔧 CHANGE THIS if needed
SRC_ROOT = Path("data_raw/DATASET")   # where TRAIN and TEST exist
OUT_ROOT = Path("data")               # output for HuggingFace training

# Map dataset labels → your labels
CLASS_MAP = {
    "O": "organic",        # waste
    "R": "recyclable"      # recycle
}

for split_src, split_dst in [("TRAIN", "train"), ("TEST", "val")]:
    for src_class, dst_class in CLASS_MAP.items():

        src_dir = SRC_ROOT / split_src / src_class
        dst_dir = OUT_ROOT / split_dst / dst_class
        dst_dir.mkdir(parents=True, exist_ok=True)

        if not src_dir.exists():
            raise SystemExit(f"Missing folder: {src_dir}")

        count = 0
        for img_path in src_dir.glob("*"):
            if img_path.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]:
                shutil.copy2(img_path, dst_dir / img_path.name)
                count += 1

        print(f"Copied {count} images from {src_dir} → {dst_dir}")

print("\n✅ Dataset ready at:", OUT_ROOT)
print("Structure:")
print("data/train/organic")
print("data/train/recyclable")
print("data/val/organic")
print("data/val/recyclable")