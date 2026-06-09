from django.db import models


class FetchSchedule(models.Model):
    FREQUENCY_CHOICES = [('daily', 'Daily'), ('weekly', 'Weekly'), ('manual', 'Manual')]
    DAY_CHOICES = [(i, name) for i, name in enumerate(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])]

    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='daily')
    day_of_week = models.IntegerField(null=True, blank=True, choices=DAY_CHOICES)
    time = models.TimeField(default='06:00')
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Fetch Schedule'

    def __str__(self):
        return f"{self.frequency} at {self.time}"


class SystemSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.key} = {self.value}"
