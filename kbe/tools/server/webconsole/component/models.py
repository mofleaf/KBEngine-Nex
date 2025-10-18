from django.db import models

class SpaceViewer(models.Model):
    class Meta:
        managed = False  # 不需要创建数据库表
        app_label = 'component'  # ✅ 指定所属应用标签
        verbose_name = 'SpaceViewer'
        verbose_name_plural = verbose_name

    def __str__(self):
        return "SpaceViewer"