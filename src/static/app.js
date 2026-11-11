document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const messageDiv = document.getElementById("message");
  const teacherInstructions = document.getElementById("teacher-instructions");
  const searchInput = document.getElementById("search");
  const categoryFilter = document.getElementById("category-filter");
  const sortBy = document.getElementById("sort-by");
  const loginToggle = document.getElementById("login-toggle");
  const loginPanel = document.getElementById("login-panel");
  const loginForm = document.getElementById("login-form");
  const logoutBtn = document.getElementById("logout-btn");
  const teacherStatus = document.getElementById("teacher-status");

  async function fetchTeacherStatus() {
    try {
      const response = await fetch("/teachers/me");
      if (!response.ok) {
        teacherStatus.textContent = "Student View";
        teacherInstructions.textContent = "Log in as a teacher to register or unregister students.";
        return false;
      }
      const result = await response.json();
      if (result.authenticated) {
        teacherStatus.textContent = `Teacher: ${result.username}`;
        teacherInstructions.textContent = "Teacher mode enabled. Use the register buttons on each activity card.";
        return true;
      }
      teacherStatus.textContent = "Student View";
      teacherInstructions.textContent = "Log in as a teacher to register or unregister students.";
      return false;
    } catch (error) {
      console.error("Error checking teacher status:", error);
      return false;
    }
  }

  async function fetchActivities() {
    try {
      const params = new URLSearchParams();
      if (categoryFilter.value && categoryFilter.value !== "all") {
        params.set("category", categoryFilter.value);
      }
      if (searchInput.value.trim()) {
        params.set("search", searchInput.value.trim());
      }
      if (sortBy.value) {
        params.set("sort", sortBy.value);
      }

      const response = await fetch(`/activities?${params.toString()}`);
      const activities = await response.json();

      activitiesList.innerHTML = "";
      const isTeacher = teacherStatus.textContent.startsWith("Teacher:");

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const category = details.category || "General";

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map((email) => `<li><span class="participant-email">${email}</span>${isTeacher ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ""}</li>`)
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        const registerButton = isTeacher
          ? `<button class="register-btn" data-activity="${name}" type="button">Register Student</button>`
          : `<button class="register-btn" data-activity="${name}" type="button" disabled>Teacher Login Required</button>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p><strong>Category:</strong> ${category}</p>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
          <div class="activity-actions">
            ${registerButton}
          </div>
        `;

        activitiesList.appendChild(activityCard);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });

      document.querySelectorAll(".register-btn").forEach((button) => {
        if (!button.disabled) {
          button.addEventListener("click", handleRegisterStudent);
        }
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleRegisterStudent(event) {
    const button = event.currentTarget;
    const activity = button.getAttribute("data-activity");
    const email = window.prompt(`Enter the student email to register for ${activity}:`);
    if (!email) return;

    try {
      const response = await fetch(`/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`, {
        method: "POST",
      });
      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        await fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }
      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to register the student.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error registering student:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        await fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  searchInput.addEventListener("input", fetchActivities);
  categoryFilter.addEventListener("change", fetchActivities);
  sortBy.addEventListener("change", fetchActivities);

  loginToggle.addEventListener("click", () => {
    loginPanel.classList.toggle("hidden");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("teacher-username").value;
    const password = document.getElementById("teacher-password").value;

    try {
      const response = await fetch("/teachers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (response.ok) {
        teacherStatus.textContent = `Teacher: ${result.username}`;
        teacherInstructions.textContent = "Teacher mode enabled. Use the register buttons on each activity card.";
        loginPanel.classList.add("hidden");
        loginForm.reset();
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
      } else {
        teacherStatus.textContent = "Student View";
        messageDiv.textContent = result.detail || "Login failed";
        messageDiv.className = "error";
      }
      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
      await fetchActivities();
    } catch (error) {
      messageDiv.textContent = "Teacher login failed.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      const response = await fetch("/teachers/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: teacherStatus.textContent.replace("Teacher: ", "") }),
      });
      if (response.ok) {
        teacherStatus.textContent = "Student View";
        teacherInstructions.textContent = "Log in as a teacher to register or unregister students.";
        loginPanel.classList.add("hidden");
      }
      await fetchActivities();
    } catch (error) {
      console.error("Error logging out:", error);
    }
  });

  fetchTeacherStatus();
  fetchActivities();
});
