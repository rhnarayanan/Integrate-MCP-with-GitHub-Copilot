"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

import json
from copy import deepcopy
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
ACTIVITIES_PATH = DATA_DIR / "activities.json"
TEACHERS_PATH = DATA_DIR / "teachers.json"


def load_json_file(path: Path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


app = FastAPI(
    title="Mergington High School API",
    description="API for viewing and signing up for extracurricular activities",
)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

app.state.activities = load_json_file(ACTIVITIES_PATH, {})
app.state.teachers = load_json_file(TEACHERS_PATH, {"teacher": "Mergington123"})
app.state.teacher_sessions = {}
activities = app.state.activities


def filter_activities(raw_activities, *, category=None, sort="name", search=""):
    items = []
    for activity_name, details in raw_activities.items():
        item = deepcopy(details)
        item["name"] = activity_name
        if category and category.lower() != "all":
            if str(item.get("category", "General")).lower() != category.lower():
                continue
        if search:
            haystack = " ".join(
                [
                    activity_name,
                    str(item.get("description", "")),
                    str(item.get("schedule", "")),
                    str(item.get("category", "")),
                ]
            ).lower()
            if search.lower() not in haystack:
                continue
        items.append((activity_name, item))

    def sort_key(entry):
        activity_name, details = entry
        sort_value = sort.lower()
        if sort_value == "category":
            return (str(details.get("category", "")).lower(), activity_name.lower())
        if sort_value == "schedule":
            return (str(details.get("schedule", "")).lower(), activity_name.lower())
        if sort_value == "availability":
            return (
                -(int(details.get("max_participants", 0)) - len(details.get("participants", []))),
                activity_name.lower(),
            )
        return activity_name.lower()

    items.sort(key=sort_key)
    return {name: details for name, details in items}


def require_teacher_auth():
    if not app.state.teacher_sessions:
        raise HTTPException(status_code=403, detail="Teacher authentication required to register or unregister students")


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities(category: str | None = None, sort: str = "name", search: str = ""):
    return filter_activities(app.state.activities, category=category, sort=sort, search=search)


@app.post("/teachers/login")
def login_teacher(payload: dict):
    username = (payload or {}).get("username")
    password = (payload or {}).get("password")
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    if app.state.teachers.get(username) != password:
        raise HTTPException(status_code=401, detail="Invalid teacher credentials")

    app.state.teacher_sessions[username] = True
    return {"username": username, "authenticated": True, "message": f"Welcome, {username}!"}


@app.post("/teachers/logout")
def logout_teacher(payload: dict | None = None):
    username = (payload or {}).get("username")
    if username:
        app.state.teacher_sessions.pop(username, None)
    return {"authenticated": False, "message": "Logged out successfully"}


@app.get("/teachers/me")
def teacher_status():
    return {"authenticated": bool(app.state.teacher_sessions), "username": next(iter(app.state.teacher_sessions), None)}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str):
    """Sign up a student for an activity"""
    require_teacher_auth()

    if activity_name not in app.state.activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = app.state.activities[activity_name]

    if email in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is already signed up")

    if len(activity["participants"]) >= activity["max_participants"]:
        raise HTTPException(status_code=400, detail=f"Activity is full. No more spots available in {activity_name}.")

    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str):
    """Unregister a student from an activity"""
    require_teacher_auth()

    if activity_name not in app.state.activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = app.state.activities[activity_name]

    if email not in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is not signed up for this activity")

    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
