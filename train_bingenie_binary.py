import numpy as np
from datasets import load_dataset
from transformers import (
    AutoImageProcessor,
    AutoModelForImageClassification,
    TrainingArguments,
    Trainer,
)
import evaluate

DATA_DIR = "data"  # your prepared folder
OUT_DIR = "models/bingenie_binary_v1"

# Good + simple base model
BASE_MODEL = "google/mobilenet_v2_1.0_224"

# 1) Load dataset
dataset = load_dataset("imagefolder", data_dir=DATA_DIR)
if "validation" in dataset and "val" not in dataset:
    dataset["val"] = dataset["validation"]
if "val" not in dataset:
    raise ValueError("Missing val split. Expecting data/val/...")

labels = dataset["train"].features["label"].names
print("✅ Labels:", labels)  # should be ['organic', 'recyclable'] (order may vary)

# 2) Processor + model
processor = AutoImageProcessor.from_pretrained(BASE_MODEL, use_fast=True)
id2label = {i: name for i, name in enumerate(labels)}
label2id = {name: i for i, name in enumerate(labels)}

model = AutoModelForImageClassification.from_pretrained(
    BASE_MODEL,
    num_labels=len(labels),
    id2label=id2label,
    label2id=label2id,
    ignore_mismatched_sizes=True,
)

# 3) Preprocess images
def preprocess(ex):
    inputs = processor(ex["image"].convert("RGB"), return_tensors="pt")
    ex["pixel_values"] = inputs["pixel_values"][0]
    return ex

dataset = dataset.map(preprocess, remove_columns=["image"])

# 4) Metrics
acc = evaluate.load("accuracy")
f1 = evaluate.load("f1")

def compute_metrics(eval_pred):
    logits, y = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {
        "accuracy": acc.compute(predictions=preds, references=y)["accuracy"],
        "f1": f1.compute(predictions=preds, references=y, average="weighted")["f1"],
    }

# 5) Train args (CPU-friendly, adjust if needed)
args = TrainingArguments(
    output_dir=OUT_DIR,
    remove_unused_columns=False,
    do_eval=True,
    save_strategy="no",
    logging_steps=25,
    learning_rate=5e-5,
    per_device_train_batch_size=32,  # CPU-friendly speedup
    per_device_eval_batch_size=32,
    num_train_epochs=2,              # for prototype
    fp16=False,
    report_to="none",
)

trainer = Trainer(
    model=model,
    args=args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["val"],
    compute_metrics=compute_metrics,
)

trainer.train()

# Save model + processor
trainer.save_model(OUT_DIR)
processor.save_pretrained(OUT_DIR)

print(f"\n✅ Saved fine-tuned model to: {OUT_DIR}")