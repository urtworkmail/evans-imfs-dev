import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_user_totp'),
    ]

    operations = [
        migrations.CreateModel(
            name='LoginSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('jti', models.CharField(max_length=64, unique=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.CharField(blank=True, max_length=300)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='login_sessions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'login_sessions',
                'ordering': ['-created_at'],
            },
        ),
    ]
