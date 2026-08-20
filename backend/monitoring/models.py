from django.db import models


class EndpointCheck(models.Model):
    """One health-check result for one monitored endpoint. Written every 60s
    by the check_endpoints_task. Pruned to the last 7 days after each daily
    report so this doesn't grow unbounded."""
    name        = models.CharField(max_length=100)
    path        = models.CharField(max_length=200)
    method      = models.CharField(max_length=10, default='GET')
    status_code = models.IntegerField(null=True, blank=True)
    is_up       = models.BooleanField(default=False)
    response_ms = models.IntegerField(null=True, blank=True)
    error       = models.CharField(max_length=300, blank=True)
    checked_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'endpoint_checks'
        ordering = ['-checked_at']
        indexes = [models.Index(fields=['name', '-checked_at'])]

    def __str__(self):
        return f"{self.name} · {'UP' if self.is_up else 'DOWN'} · {self.checked_at:%Y-%m-%d %H:%M}"
