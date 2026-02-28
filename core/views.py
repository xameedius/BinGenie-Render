from django.shortcuts import render
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse
from PIL import Image

from .space_infer import predict_upload


def home(request):
    return render(request, "home.html")

def healthz(request):
    return JsonResponse({"ok": True})

@require_http_methods(["POST"])
def predict(request):
    uploaded = request.FILES.get("photo")
    if not uploaded:
        return render(request, "home.html", {"error": "No image uploaded."})

    # Validate it's an image (optional but nice)
    try:
        Image.open(uploaded)
        uploaded.seek(0)
    except Exception:
        return render(request, "home.html", {"error": "That file doesn’t look like a valid image."})

    try:
        preds = predict_upload(uploaded)  # list of dicts
    except Exception as e:
        return render(request, "home.html", {"error": f"Inference failed: {type(e).__name__}: {e!r}"})

    best = preds[0] if isinstance(preds, list) and preds else {"label": "unknown", "score": 0.0}
    label = best.get("label", "unknown")
    confidence = float(best.get("score", 0.0))

    pred = {
        "label": label,
        "confidence": confidence,
        "is_recyclable": str(label).lower() == "recyclable",
        "top3": preds,
    }

    return render(request, "home.html", {"pred": pred})


@require_http_methods(["POST"])
def predict_api(request):
    uploaded = request.FILES.get("photo")
    if not uploaded:
        return JsonResponse({"error": "No image uploaded."}, status=400)

    try:
        Image.open(uploaded)
        uploaded.seek(0)
    except Exception:
        return JsonResponse({"error": "Invalid image file."}, status=400)

    try:
        preds = predict_upload(uploaded)
    except Exception as e:
        return JsonResponse({"error": f"Inference failed: {type(e).__name__}: {e!r}"}, status=500)

    best = preds[0] if isinstance(preds, list) and preds else {"label": "unknown", "score": 0.0}
    label = best.get("label", "unknown")
    confidence = float(best.get("score", 0.0))

    return JsonResponse({
        "label": label,
        "confidence": confidence,
        "is_recyclable": str(label).lower() == "recyclable",
        "top3": preds,
    })


def intro(request):
    return render(request, "intro.html")


def about(request):
    return render(request, "about.html")