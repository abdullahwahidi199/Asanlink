from django.core.management.base import BaseCommand

from accounts.services import seed_authorization


class Command(BaseCommand):
    help = "Create or update the system permission registry and default roles."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-defaults",
            action="store_true",
            help="Reset MANAGER and DATA_ENTRY permissions to the shipped defaults.",
        )

    def handle(self, *args, **options):
        permissions, roles = seed_authorization(
            reset_defaults=options["reset_defaults"],
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Authorization ready: {len(permissions)} permissions and {len(roles)} default roles."
            )
        )

