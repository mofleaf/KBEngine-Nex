from django.contrib import admin

# Register your models here.
from django.contrib import admin
from django.contrib.auth.models import User, Group
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin, GroupAdmin
from django.shortcuts import render
from django.template.response import TemplateResponse

from KBESettings.custom_admin_site import custom_admin_site
from .models import KBEUserExtension

class KBEUserExtensionInline(admin.StackedInline):
    model = KBEUserExtension
    can_delete = False
    verbose_name= '用户扩展数据'


class UserAdmin(BaseUserAdmin):
    inlines = (KBEUserExtensionInline,)

admin.site = custom_admin_site

# admin.site.unregister(User)
admin.site.register(User, UserAdmin)
admin.site.register(Group, GroupAdmin)

