import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForImageClassification

MODEL_NAME = "models/bingenie_binary_v1"

_device = torch.device("cpu")
_processor = AutoImageProcessor.from_pretrained(MODEL_NAME, use_fast=True)
_model = AutoModelForImageClassification.from_pretrained(MODEL_NAME).to(_device)
_model.eval()

RECYCLE_LABEL = "recyclable"  # must match your training folder name
WASTE_LABEL = "organic"       # must match your training folder name

MIN_CONFIDENCE = 0.60  # start here; tune after testing

def predict_pil(img: Image.Image) -> dict:
    img = img.convert("RGB")

    inputs = _processor(images=img, return_tensors="pt")
    inputs = {k: v.to(_device) for k, v in inputs.items()}

    with torch.no_grad():
        logits = _model(**inputs).logits
        probs = torch.softmax(logits, dim=-1)[0]

    topk = torch.topk(probs, k=2)
    top = []
    for score, idx in zip(topk.values.tolist(), topk.indices.tolist()):
        label = _model.config.id2label[int(idx)]
        top.append({"label": label, "score": float(score)})

    best_label = top[0]["label"].lower()
    best_conf = top[0]["score"]

    # Avoid claiming recycle when uncertain
    if best_conf < MIN_CONFIDENCE:
        return {
            "label": top[0]["label"],
            "confidence": best_conf,
            "is_recyclable": False,
            "top3": top,
            "note": "Low confidence → treated as waste"
        }

    return {
        "label": top[0]["label"],
        "confidence": best_conf,
        "is_recyclable": (best_label == RECYCLE_LABEL),
        "top3": top,
    }