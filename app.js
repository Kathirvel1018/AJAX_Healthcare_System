
//  WORKFLOW:
//  1. Page loads  → fetch CSRF token → load all appointments
//  2. Form submit → POST (create) or PUT (update) via fetch()
//  3. Edit button → fill form with that row's data
//  4. Delete btn  → DELETE request with confirm prompt
//  5. Status drop → PUT request with only id + status
// ─────────────────────────────────────────────────────────────

// Stores the CSRF token received from the server.
// Every POST / PUT / DELETE request must send this token.
// The server checks it to block fake requests (Cross-Site attacks).
let csrfToken = "";

// Grab the HTML elements we'll use often, stored in variables
// so we don't call getElementById() repeatedly.
const form    = document.getElementById("appointmentForm");   // the booking form
const table   = document.getElementById("appointmentTable");  // <tbody> of the list
const message = document.getElementById("message");           // success/error banner div


// ── Step 2: On Page Load ──────────────────────────────────────

// window.onload fires AFTER the full page (HTML + CSS) is ready.
// We use async so we can use await inside it.
window.onload = async () => {

    // Fetch CSRF token from server (api.php?action=get_csrf)
    // The server creates a random token, saves it in $_SESSION,
    // and sends it back as JSON: { "success": true, "csrf_token": "abc123..." }
    const response = await fetch("api.php?action=get_csrf");

    // Parse the JSON response into a JS object
    const result = await response.json();

    // Save the token into our global variable for later use
    csrfToken = result.csrf_token;

    // Now load and display all appointments from the database
    loadAppointments();
};


// ── Step 3: Show Message Banner ───────────────────────────────

// This function shows a success or error message below the form.
// text  = the message string  (e.g. "Appointment Created Successfully")
// type  = CSS class name       ("success" or "error")
function showMessage(text, type) {

    // Set the message text inside the div
    message.innerHTML = text;

    // Apply the CSS class: "success" = green, "error" = red
    message.className = type;

    // Auto-hide the message after 3 seconds (3000 ms)
    setTimeout(() => {
        message.innerHTML = ""; // clear text
        message.className  = ""; // remove color class
    }, 3000);
}


// ── Step 4: Load All Appointments (GET) ───────────────────────

// Fetches all rows from the DB and renders them in the <tbody>.
// Called on page load AND after every create / update / delete.
async function loadAppointments() {

    try {

        // Send a GET request to api.php (default method = GET)
        const response = await fetch("api.php");

        // Parse the JSON: { "success": true, "data": [ {...}, {...} ] }
        const result = await response.json();

        // Clear old table rows before rendering fresh data
        table.innerHTML = "";

        // Loop through each appointment object in the data array
        result.data.forEach(row => {

            // Build one <tr> row per appointment using template literals
            // row.id, row.patient_name, etc. come from the DB columns
            table.innerHTML += `

            <tr id="row-${row.id}">

                <td>${row.id}</td>
                <td>${row.patient_name}</td>
                <td>${row.email}</td>
                <td>${row.mobile}</td>
                <td>${row.doctor_name}</td>
                <td>${row.appointment_date}</td>
                <td>${row.appointment_time}</td>

                <!-- Status dropdown: pre-selects the current status -->
                <td>
                    <select onchange="changeStatus(${row.id}, this.value)">

                        <option ${row.status === "Pending"   ? "selected" : ""}>Pending</option>
                        <option ${row.status === "Confirmed" ? "selected" : ""}>Confirmed</option>
                        <option ${row.status === "Cancelled" ? "selected" : ""}>Cancelled</option>

                    </select>
                </td>

                <!-- Action buttons: call editAppointment() or deleteAppointment() -->
                <td>
                    <div class="action-group">

                        <button class="btn btn-edit"
                                onclick="editAppointment(${row.id})">
                            ✏️ Edit
                        </button>

                        <button class="btn btn-delete"
                                onclick="deleteAppointment(${row.id})">
                            🗑️ Delete
                        </button>

                    </div>
                </td>

            </tr>`;
        });

    } catch (error) {

        // If fetch itself fails (network error, server down), show error
        showMessage("Failed to load appointments. Check server.", "error");
    }
}


// ── Step 5: Save Appointment (POST = Create, PUT = Update) ────

// Attached to the form's submit event.
// If appointment_id hidden field is empty → POST (create new).
// If appointment_id has a value           → PUT  (update existing).
form.addEventListener("submit", saveAppointment);

async function saveAppointment(e) {

    // e.preventDefault() stops the browser from doing a full-page
    // form submit (which would reload the page and lose our data).
    e.preventDefault();

    // Read the hidden field value.
    // Empty string "" = new appointment, a number = editing existing.
    const id = document.getElementById("appointment_id").value;

    // Build the data object from all form field values
    const data = {
        id              : id,   // empty for POST, number for PUT
        patient_name    : document.getElementById("patient_name").value,
        email           : document.getElementById("email").value,
        mobile          : document.getElementById("mobile").value,
        doctor_name     : document.getElementById("doctor_name").value,
        appointment_date: document.getElementById("appointment_date").value,
        appointment_time: document.getElementById("appointment_time").value,
        csrf_token      : csrfToken   // attach the token for server validation
    };

    // Decide method: if id exists use PUT (update), else use POST (create)
    const method = id ? "PUT" : "POST";

    try {

        // Send the request to api.php
        const response = await fetch("api.php", {
            method : method,                          // "POST" or "PUT"
            headers: { "Content-Type": "application/json" }, // tell server it's JSON
            body   : JSON.stringify(data)             // convert JS object → JSON string
        });

        // Parse the server's response
        const result = await response.json();

        if (result.success) {

            // Show green success message
            showMessage(result.message, "success");

            // Clear all form fields
            form.reset();

            // Also clear the hidden ID field (reset() doesn't clear hidden inputs)
            document.getElementById("appointment_id").value = "";

            // Refresh the table to show the new / updated record
            loadAppointments();

        } else {

            // Show red error message (e.g. "Slot Already Booked")
            showMessage(result.message, "error");
        }

    } catch (error) {

        // Network or server-side crash — show actual error for debugging
        showMessage("Server Error: " + error.message, "error");
    }
}


// ── Step 6: Edit Appointment ──────────────────────────────────

// When the user clicks Edit on a row:
// 1. Fetch all appointments from the server
// 2. Find the one matching the clicked id
// 3. Fill the form fields with that record's values
// 4. The form now has the id in the hidden field →
//    next Save click will use PUT instead of POST
async function editAppointment(id) {

    // Fetch the full list (simple approach — gets fresh data)
    const response = await fetch("api.php");
    const result   = await response.json();

    // Find the single record whose id matches the button clicked
    // result.data is an array; .find() returns the first matching object
    const record = result.data.find(item => item.id == id);

    // Fill each form field with the record's values
    document.getElementById("appointment_id").value    = record.id;
    document.getElementById("patient_name").value      = record.patient_name;
    document.getElementById("email").value             = record.email;
    document.getElementById("mobile").value            = record.mobile;
    document.getElementById("doctor_name").value       = record.doctor_name;
    document.getElementById("appointment_date").value  = record.appointment_date;
    document.getElementById("appointment_time").value  = record.appointment_time;

    // Scroll the page up so the user sees the filled form
    form.scrollIntoView({ behavior: "smooth" });
}


// ── Step 7: Delete Appointment (DELETE) ───────────────────────

// Asks user to confirm, then sends a DELETE request with the id.
async function deleteAppointment(id) {

    // confirm() shows a browser pop-up with OK / Cancel.
    // If user clicks Cancel, confirm() returns false → we stop.
    if (!confirm("Are you sure you want to delete this appointment?")) {
        return; // exit function, do nothing
    }

    // Send DELETE request to api.php
    const response = await fetch("api.php", {
        method : "DELETE",
        headers: { "Content-Type": "application/json" },

        // Send the appointment id and CSRF token in the request body
        body: JSON.stringify({
            id        : id,
            csrf_token: csrfToken
        })
    });

    // Parse the response
    const result = await response.json();

    // Show success or error message based on result
    showMessage(result.message, result.success ? "success" : "error");

    // Refresh the table (the deleted row will be gone)
    loadAppointments();
}


// ── Step 8: Change Status (PUT – status only) ─────────────────

// Called automatically when the user changes the dropdown value
// inside a table row (onchange="changeStatus(id, value)").
// Sends only: id + status + csrf_token  (no full record needed).
async function changeStatus(id, status) {

    // Send PUT request with partial data (just status update)
    const response = await fetch("api.php", {
        method : "PUT",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({
            id        : id,
            status    : status,
            csrf_token: csrfToken
        })
    });

    // Parse response
    const result = await response.json();

    if (result.success) {

        // Find the <tr> with id="row-{id}" and flash it yellow
        // to give visual feedback that the status was saved
        const row = document.getElementById(`row-${id}`);

        // Add the CSS class that sets background to light yellow
        row.classList.add("highlight");

        // Remove the highlight after 2 seconds
        setTimeout(() => {
            row.classList.remove("highlight");
        }, 2000);

    } else {

        // If something went wrong on the server, show error
        showMessage(result.message, "error");
    }
}