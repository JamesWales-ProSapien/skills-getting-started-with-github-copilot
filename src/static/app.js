document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const emailInput = document.getElementById("email");
  const messageDiv = document.getElementById("message");
  let messageTimeoutId;
  let activitiesByName = {};

  function showMessage(text, type) {
    if (messageTimeoutId) {
      clearTimeout(messageTimeoutId);
    }

    messageDiv.textContent = text;
    messageDiv.className = `toast ${type}`;
    messageDiv.classList.add("toast-visible");

    messageTimeoutId = setTimeout(() => {
      messageDiv.classList.remove("toast-visible");
    }, 5000);
  }

  function setActivitiesLoading(isLoading) {
    activitiesList.classList.toggle("activities-loading", isLoading);
    activitiesList.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  function validateDuplicateSignup(shouldReport = false) {
    const email = emailInput.value.trim().toLowerCase();
    const activityName = activitySelect.value;

    emailInput.setCustomValidity("");

    if (!email || !activityName) {
      if (shouldReport) {
        emailInput.reportValidity();
      }
      return true;
    }

    const participants = activitiesByName[activityName]?.participants || [];
    const isDuplicate = participants.some((participant) => participant.toLowerCase() === email);

    if (isDuplicate) {
      emailInput.setCustomValidity("This email is already registered for the selected activity.");
    }

    if (shouldReport || isDuplicate) {
      emailInput.reportValidity();
    }

    return !isDuplicate;
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    setActivitiesLoading(true);

    try {
      const response = await fetch(`/activities?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const activities = await response.json();
      activitiesByName = activities;

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const participantsListHtml = details.participants.length
          ? details.participants
              .map(
                (participant) => `
                  <li class="participant-item">
                    <span class="participant-email">${participant}</span>
                    <button
                      type="button"
                      class="participant-delete"
                      data-activity="${name}"
                      data-email="${participant}"
                      aria-label="Remove ${participant} from ${name}"
                      title="Unregister participant"
                    >
                      &times;
                    </button>
                  </li>`
              )
              .join("")
          : "<li class=\"participants-empty\">No participants yet. Be the first to join!</li>";

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-section">
            <p class="participants-title"><strong>Participants</strong></p>
            <ul class="participants-list">
              ${participantsListHtml}
            </ul>
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      validateDuplicateSignup();
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    } finally {
      setActivitiesLoading(false);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const activity = activitySelect.value;

    if (!validateDuplicateSignup(true)) {
      showMessage("This student is already signed up for the selected activity.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        await fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  emailInput.addEventListener("input", () => {
    validateDuplicateSignup();
  });

  activitySelect.addEventListener("change", () => {
    validateDuplicateSignup();
  });

  activitiesList.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest(".participant-delete");
    if (!deleteButton) {
      return;
    }

    const activity = deleteButton.dataset.activity;
    const email = deleteButton.dataset.email;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/participants?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "error");
        await fetchActivities();
      } else {
        showMessage(result.detail || "Failed to unregister participant.", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister participant. Please try again.", "error");
      console.error("Error unregistering participant:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
