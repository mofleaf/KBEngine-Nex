from django.contrib import admin

# Register your models here.
from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.shortcuts import render
from django.template.response import TemplateResponse

from .models import KBEUserExtension


class KBEUserExtensionInline(admin.StackedInline):
    model = KBEUserExtension
    can_delete = False
    verbose_name= '用户扩展数据'

    admin.site.site_title = "KBEngine Nex Web Console"
    admin.site.index_title = "KBEngine Nex Web Console"
    admin.site.site_header = 'KBEngine Nex'


class UserAdmin(BaseUserAdmin):
    inlines = (KBEUserExtensionInline,)

admin.site.unregister(User)
admin.site.register(User, UserAdmin)

