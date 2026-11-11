from fastapi.testclient import TestClient

from src.app import app

client = TestClient(app)


def test_activities_include_github_skills():
    response = client.get('/activities')
    assert response.status_code == 200
    data = response.json()
    assert 'GitHub Skills' in data
    assert data['GitHub Skills']['category'] == 'Technology'


def test_signup_rejects_full_activity(monkeypatch):
    app.state.teacher_sessions.clear()
    client.post('/teachers/login', json={'username': 'teacher', 'password': 'Mergington123'})

    activity_name = 'Chess Club'
    original = app.state.activities['Chess Club']['participants']
    app.state.activities['Chess Club']['participants'] = ['a@mergington.edu'] * 12
    try:
        response = client.post(f'/activities/{activity_name}/signup', params={'email': 'b@mergington.edu'})
        assert response.status_code == 400
        assert 'full' in response.json()['detail'].lower()
    finally:
        app.state.activities['Chess Club']['participants'] = original
        app.state.teacher_sessions.clear()


def test_teacher_login_success():
    response = client.post('/teachers/login', json={'username': 'teacher', 'password': 'Mergington123'})
    assert response.status_code == 200
    body = response.json()
    assert body['username'] == 'teacher'
    assert body['authenticated'] is True


def test_signup_requires_teacher_auth():
    app.state.teacher_sessions.clear()
    response = client.post('/activities/Chess Club/signup', params={'email': 'new@mergington.edu'})
    assert response.status_code == 403
    assert 'teacher' in response.json()['detail'].lower()
