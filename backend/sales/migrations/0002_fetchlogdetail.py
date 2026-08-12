from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='FetchLogDetail',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('level', models.CharField(choices=[('info', 'Info'), ('warning', 'Warning'), ('error', 'Error')], default='info', max_length=10)),
                ('message', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('fetch_log', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='details', to='sales.fetchlog')),
            ],
            options={
                'ordering': ['id'],
            },
        ),
    ]
