import getpass
import os

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import password_validation
from django.db import transaction

from accounts.constants import ADMIN_ROLE_NAME
from accounts.models import Role, User


class Command(BaseCommand):
    help = "Create or promote the first Asanlink administrator safely."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="admin")
        parser.add_argument("--email")
        parser.add_argument("--noinput", action="store_true")
        parser.add_argument(
            "--password-env",
            default="ASANLINK_ADMIN_PASSWORD",
            help="Environment variable containing the password in non-interactive mode.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        call_command("seed_authorization", verbosity=0)
        username = options["username"].strip()
        email = (options.get("email") or "").strip().lower()

        if not email and not options["noinput"]:
            email = input("Email address: ").strip().lower()
        if not email:
            raise CommandError("An email address is required. Use --email.")

        password = os.getenv(options["password_env"])
        if not password and not options["noinput"]:
            password = getpass.getpass("Password: ")
            confirmation = getpass.getpass("Password (again): ")
            if password != confirmation:
                raise CommandError("Passwords do not match.")
        if not password:
            raise CommandError(
                f"Set {options['password_env']} when using --noinput."
            )

        password_validation.validate_password(password)

        role = Role.objects.get(name=ADMIN_ROLE_NAME)
        user = User.objects.filter(username__iexact=username).first()
        if user and user.email.lower() != email:
            raise CommandError("That username already belongs to a different email address.")
        if not user and User.objects.filter(email__iexact=email).exists():
            raise CommandError("That email address already belongs to another user.")

        if user is None:
            user = User(username=username, email=email)
        user.email = email
        user.role = role
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.set_password(password)
        user.full_clean(exclude=("last_login", "date_joined"))
        user.save()
        self.stdout.write(self.style.SUCCESS(f"Administrator '{user.username}' is ready."))
