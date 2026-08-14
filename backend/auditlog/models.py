from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """
    Record of a security/administration-relevant action — who did what,
    to what, and from where. Super Admin only. actor_username is a snapshot
    (kept even if the user account is later deleted); actor is the live FK
    for convenience while it still exists.
    """
    actor          = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                        on_delete=models.SET_NULL, related_name='audit_logs')
    actor_username = models.CharField(max_length=150, blank=True)
    action         = models.CharField(max_length=60)
    target         = models.CharField(max_length=200, blank=True)
    details        = models.JSONField(default=dict, blank=True)
    ip_address     = models.GenericIPAddressField(null=True, blank=True)
    user_agent     = models.CharField(max_length=300, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.actor_username or 'system'} · {self.action} · {self.target}"
