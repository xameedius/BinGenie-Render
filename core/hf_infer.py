# core/hf_infer.py
from huggingface_hub import InferenceClient
from requests import HTTPError

HF_MODEL = "xameedius/bingenie-binary-v1"
HF_TOKEN = "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"

client = InferenceClient(model=HF_MODEL, token=HF_TOKEN)

def predict_image_bytes(image_bytes: bytes):
    try:
        return client.image_classification(image=image_bytes)
    except HTTPError as e:
        # Try to show server response body (very helpful)
        resp = getattr(e, "response", None)
        body = ""
        if resp is not None:
            try:
                body = resp.text[:500]
            except Exception:
                body = ""
        raise RuntimeError(f"HTTPError {getattr(resp, 'status_code', '')} {body}") from e