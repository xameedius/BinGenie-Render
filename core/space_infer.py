# core/space_infer.py
import tempfile
from gradio_client import Client, handle_file

# ✅ hardcoded Space ID
SPACE_ID = "xameedius/bingenie-space"

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = Client(SPACE_ID)
    return _client

def predict_upload(django_uploaded_file):
    """
    Sends the uploaded image file to the Hugging Face Space and returns predictions.
    Expected return: list[{"label": str, "score": float}, ...]
    """
    # Gradio client needs a file path, so write Django upload to a temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        for chunk in django_uploaded_file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    client = _get_client()

    # This matches a simple gr.Interface with one image input.
    result = client.predict(handle_file(tmp_path))
    return result