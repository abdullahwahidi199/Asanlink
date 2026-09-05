from django.db import migrations


PERMISSIONS = (
    ("View finance", "finance.view", "View company finance dashboards and ledgers.", "finance", "view"),
    ("Create expenses", "finance.expenses.create", "Create company expense records.", "finance.expenses", "create"),
    ("Edit expenses", "finance.expenses.edit", "Edit draft or rejected expense records.", "finance.expenses", "edit"),
    ("Submit expenses", "finance.expenses.submit", "Submit expenses for approval.", "finance.expenses", "submit"),
    ("Approve expenses", "finance.expenses.approve", "Approve submitted expenses.", "finance.expenses", "approve"),
    ("Reject expenses", "finance.expenses.reject", "Reject submitted expenses with a reason.", "finance.expenses", "reject"),
    ("Record expense payments", "finance.expenses.record", "Mark approved expenses as paid or recorded.", "finance.expenses", "record"),
    ("Create contributions", "finance.contributions.create", "Record founder and member contributions.", "finance.contributions", "create"),
    ("Edit contributions", "finance.contributions.edit", "Edit or void contribution records.", "finance.contributions", "edit"),
    ("View settlements", "finance.settlements.view", "View member balances and settlement recommendations.", "finance.settlements", "view"),
    ("Record settlements", "finance.settlements.settle", "Record and mark member settlements as paid.", "finance.settlements", "settle"),
    ("View finance reports", "finance.reports.view", "View finance reports and cash-flow analysis.", "finance.reports", "view"),
    ("Export finance reports", "finance.reports.export", "Export filtered finance data as CSV or PDF.", "finance.reports", "export"),
    ("Manage recurring expenses", "finance.recurring.manage", "Create, pause, edit, and generate recurring expenses.", "finance.recurring", "manage"),
)

ROLE_PERMISSIONS = {
    "ADMIN": tuple(item[1] for item in PERMISSIONS),
    "MANAGER": (
        "finance.view", "finance.expenses.create", "finance.expenses.edit",
        "finance.expenses.submit", "finance.contributions.create", "finance.contributions.edit",
        "finance.settlements.view", "finance.reports.view", "finance.reports.export",
        "finance.recurring.manage",
    ),
    "DATA_ENTRY": (
        "finance.view", "finance.expenses.create", "finance.expenses.submit",
        "finance.contributions.create",
    ),
}

CATEGORIES = (
    ("Hosting & Infrastructure", "hosting-infrastructure", "#2563eb"),
    ("Software & SaaS", "software-saas", "#7c3aed"),
    ("Domains", "domains", "#0891b2"),
    ("Marketing", "marketing", "#db2777"),
    ("Office & Operations", "office-operations", "#d97706"),
    ("Professional Services", "professional-services", "#4f46e5"),
    ("Travel", "travel", "#059669"),
    ("Other", "other", "#64748b"),
)


def seed_finance_defaults(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    ExpenseCategory = apps.get_model("finance", "ExpenseCategory")
    permission_objects = {}
    for name, codename, description, module, action in PERMISSIONS:
        permission, _ = Permission.objects.update_or_create(
            codename=codename,
            defaults={
                "name": name,
                "description": description,
                "module": module,
                "action": action,
                "is_active": True,
            },
        )
        permission_objects[codename] = permission
    for role_name, codenames in ROLE_PERMISSIONS.items():
        role = Role.objects.filter(name=role_name).first()
        if role:
            role.permissions.add(*(permission_objects[codename] for codename in codenames))
    for name, slug, color in CATEGORIES:
        ExpenseCategory.objects.update_or_create(
            slug=slug,
            defaults={"name": name, "color": color, "is_active": True},
        )


def preserve_finance_history(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_seed_initial_authorization"),
        ("finance", "0001_initial"),
    ]

    operations = [migrations.RunPython(seed_finance_defaults, preserve_finance_history)]
