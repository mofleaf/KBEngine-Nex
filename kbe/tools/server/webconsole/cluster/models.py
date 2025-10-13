from django.db import models

class ServerConfig(models.Model):
    class Meta:
        managed = False                # 不需要创建数据库表
        app_label = 'cluster'          # ✅ 指定所属应用标签
        verbose_name = '服务器运行配置'
        verbose_name_plural = verbose_name

    def __str__(self):
        return "服务器运行配置"

class ServerManage(models.Model):
    class Meta:
        managed = False  # 不需要创建数据库表
        app_label = 'cluster'  # ✅ 指定所属应用标签
        verbose_name = '服务器管理'
        verbose_name_plural = verbose_name

    def __str__(self):
        return "服务器管理"