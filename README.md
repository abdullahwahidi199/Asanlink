git clone https://github.com/abdullahwahidi199/Asanlink
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
make a .env.example file in backend root dir and add the following  


DJANGO_DEBUG=True
DJANGO_SECRET_KEY=replace-with-a-long-random-value
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
CSRF_TRUSTED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
DJANGO_TIME_ZONE=Asia/Kabul
SECURE_SSL_REDIRECT=False
SECURE_HSTS_SECONDS=0

# Configure a production SMTP backend before deployment.
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=localhost
EMAIL_PORT=25
EMAIL_USE_TLS=False
DEFAULT_FROM_EMAIL=no-reply@localhost

# SQLite is the development default. For PostgreSQL, install psycopg and set:
# DB_ENGINE=django.db.backends.postgresql
# DB_NAME=asanlink
# DB_USER=asanlink
# DB_PASSWORD=change-me
# DB_HOST=127.0.0.1
# DB_PORT=5432

# Used only by: python manage.py bootstrap_admin --noinput --email you@example.com
# ASANLINK_ADMIN_PASSWORD=replace-with-a-strong-one-time-password

 

python manage.py migrate

cd ..
cd frontend
npm install

make a .env.example and add    VITE_API_URL=http://127.0.0.1:8000/api

npm run dev




asanlink/
│
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   └── ...
│
├── frontend/
│   ├── package.json
│   ├── src/
│   └── ...
│
├── .gitignore
└── README.md
