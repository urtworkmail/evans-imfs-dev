import json

from django.contrib.auth.hashers import make_password
from django.db import migrations


MONITOR_USERNAME = 'system-monitor'


def create_monitor_user(apps, schema_editor):
    # apps.get_model() returns a historical model with only fields, not the
    # real User class's methods — so set_unusable_password() isn't
    # available here. make_password(None) is the documented equivalent.
    User = apps.get_model('users', 'User')
    User.objects.get_or_create(
        username=MONITOR_USERNAME,
        defaults={
            'email':      'system-monitor@internal.local',
            'first_name': 'System',
            'last_name':  'Monitor',
            'role':       'admin',
            'is_active':  True,
            'password':   make_password(None),
        },
    )


def remove_monitor_user(apps, schema_editor):
    User = apps.get_model('users', 'User')
    User.objects.filter(username=MONITOR_USERNAME).delete()


def schedule_tasks(apps, schema_editor):
    IntervalSchedule = apps.get_model('django_celery_beat', 'IntervalSchedule')
    CrontabSchedule   = apps.get_model('django_celery_beat', 'CrontabSchedule')
    PeriodicTask      = apps.get_model('django_celery_beat', 'PeriodicTask')

    interval, _ = IntervalSchedule.objects.get_or_create(every=60, period='seconds')
    PeriodicTask.objects.update_or_create(
        name='monitoring-check-endpoints',
        defaults={
            'interval': interval,
            'crontab':  None,
            'task':     'monitoring.tasks.check_endpoints_task',
            'enabled':  True,
            'kwargs':   json.dumps({}),
        },
    )

    crontab, _ = CrontabSchedule.objects.get_or_create(
        minute='0', hour='8', day_of_week='*', day_of_month='*', month_of_year='*',
    )
    PeriodicTask.objects.update_or_create(
        name='monitoring-daily-status-report',
        defaults={
            'crontab': crontab,
            'interval': None,
            'task':    'monitoring.tasks.send_daily_status_report_task',
            'enabled': True,
            'kwargs':  json.dumps({}),
        },
    )


def unschedule_tasks(apps, schema_editor):
    PeriodicTask = apps.get_model('django_celery_beat', 'PeriodicTask')
    PeriodicTask.objects.filter(
        name__in=['monitoring-check-endpoints', 'monitoring-daily-status-report']
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('monitoring', '0001_initial'),
        ('users', '0004_loginsession'),
        ('django_celery_beat', '0018_improve_crontab_helptext'),
    ]

    operations = [
        migrations.RunPython(create_monitor_user, remove_monitor_user),
        migrations.RunPython(schedule_tasks, unschedule_tasks),
    ]
