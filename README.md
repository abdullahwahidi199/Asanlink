# Asanlink – Local Development Setup

Follow these steps to set up the Asanlink project on your local machine.

## 1. Clone the Repository

Open your terminal and run:

```bash
git clone https://github.com/abdullahwahidi199/Asanlink
cd Asanlink
```

The project structure should look like this:

```text
Asanlink/
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
```

---

# 2. Backend Setup

Go to the backend directory:

```bash
cd backend
```

### Create a Python Virtual Environment

```bash
python -m venv venv
```

### Activate the Virtual Environment

On Windows:

```bash
venv\Scripts\activate
```

You should now see `(venv)` in your terminal.

### Install Backend Dependencies

```bash
pip install -r requirements.txt
```

---



# 4. Run Database Migrations

Make sure you are still inside the `backend/` directory and run:

```bash
python manage.py migrate
```

---

# 5. Start the Backend

Run:

```bash
python manage.py runserver


# 6. Frontend Setup

Open a **new terminal** and go to the frontend directory:

```bash
cd Asanlink/frontend
```

Install the frontend dependencies:

```bash
npm install
```



# 8. Start the Frontend

Run:

```bash
npm run dev
```



# Final Development Setup

You should have **two terminals running**:

### Terminal 1 – Backend

```bash
cd Asanlink/backend
venv\Scripts\activate
python manage.py runserver
```

### Terminal 2 – Frontend

```bash
cd Asanlink/frontend
npm run dev
```

The frontend communicates with the Django backend through:

```text
Frontend:
http://127.0.0.1:5173

Backend API:
http://127.0.0.1:8000/api
```

## Important Git Rules
* Before starting a new feature, create a new Git branch.
* Do not directly work on the `main` branch.
* Pull the latest changes before starting your work.
* Create a Pull Request when your feature is ready to merge.
