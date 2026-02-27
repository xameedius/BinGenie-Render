import numpy as np
from datasets import load_dataset
from transformers import AutoImageProcessor, AutoModelForImageClassification
import torch
from sklearn.metrics import classification_report, confusion_matrix

MODEL_DIR = "models/bingenie_binary_v1"
DATA_DIR = "data"

device = torch.device("cpu")
processor = AutoImageProcessor.from_pretrained(MODEL_DIR, use_fast=True)
model = AutoModelForImageClassification.from_pretrained(MODEL_DIR).to(device)
model.eval()

ds = load_dataset("imagefolder", data_dir=DATA_DIR)
if "val" not in ds and "validation" in ds:
    ds["val"] = ds["validation"]

labels = ds["train"].features["label"].names

y_true = []
y_pred = []

for ex in ds["val"]:
    img = ex["image"].convert("RGB")
    inputs = processor(images=img, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        logits = model(**inputs).logits
    pred = int(torch.argmax(logits, dim=-1).item())

    y_true.append(int(ex["label"]))
    y_pred.append(pred)

print("Labels:", labels)
print("\nConfusion Matrix:\n", confusion_matrix(y_true, y_pred))
print("\nReport:\n", classification_report(y_true, y_pred, target_names=labels))