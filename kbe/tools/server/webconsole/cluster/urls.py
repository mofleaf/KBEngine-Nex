"""
URL configuration for KBESettings project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from . import views
urlpatterns = [
    path("server_shutdown/", admin.site.admin_view(views.server_shutdown), name="server_shutdown"),
    path("server_kill/", admin.site.admin_view(views.server_kill), name="server_kill"),
    path("server_run/", admin.site.admin_view(views.server_run), name="server_run"),
    path("server_stop/", admin.site.admin_view(views.server_stop), name="server_stop"),
    path("server_query/", admin.site.admin_view(views.server_query), name="server_query"),
]
