from django.template.response import TemplateResponse
from cluster.models import ServerConfig
from django.contrib import admin


@admin.register(ServerConfig)
class ServerConfigAdmin(admin.ModelAdmin):
    change_list_template = "cluster/server_config.html"
    list_display = []

    def has_add_permission(self, request): return False
    def has_delete_permission(self, request, obj=None): return False

    def changelist_view(self, request, extra_context=None):
        context = {
            **self.admin_site.each_context(request),
            "title": self.model._meta.verbose_name_plural,
            "cl": {
                "model":self.model,
                "model_admin": self,
                "opts": self.model._meta
            },
            **(extra_context or {}),
        }
        return TemplateResponse(request, self.change_list_template, context)

