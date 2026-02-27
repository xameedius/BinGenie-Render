from django.urls import path
from . import views

urlpatterns = [
    path("", views.intro, name="intro"),
    path("scan/", views.home, name="home"),
    path("about/", views.about, name="about"),

    path("predict/", views.predict, name="predict"),
    path("predict-api/", views.predict_api, name="predict_api"),
]