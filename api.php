<?php
// api.php – Appointment REST API

// Suppress PHP warnings from polluting JSON output
error_reporting(0);
ini_set('display_errors', 0);

session_start();

// CSRF token generator
if (isset($_GET['action']) && $_GET['action'] === 'get_csrf') {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    header("Content-Type: application/json");
    echo json_encode(["success" => true, "csrf_token" => $_SESSION['csrf_token']]);
    exit;
}

header("Content-Type: application/json");

// Catch any uncaught exception (e.g. mysqli strict mode in PHP 8.1+)
set_exception_handler(function($e) {
    echo json_encode(["success" => false, "message" => "Exception: " . $e->getMessage()]);
    exit;
});

include "config.php";

$method = $_SERVER['REQUEST_METHOD'];

// GET – Fetch all appointments
if ($method === "GET") {
    $result = mysqli_query($conn, "SELECT * FROM appointments ORDER BY id DESC");
    if (!$result) {
        echo json_encode(["success" => false, "message" => "Query failed: " . mysqli_error($conn)]);
        exit;
    }
    $rows = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $rows[] = $row;
    }
    echo json_encode(["success" => true, "data" => $rows]);
    exit;
}

// Read JSON body for POST / PUT / DELETE
$data = json_decode(file_get_contents("php://input"), true) ?? [];

// CSRF validation
if (!isset($data['csrf_token']) || !isset($_SESSION['csrf_token']) ||
     $data['csrf_token'] !== $_SESSION['csrf_token']) {
    echo json_encode(["success" => false, "message" => "Invalid CSRF Token"]);
    exit;
}

// Shared input validation
function validateInput($data) {
    if (empty($data['patient_name']) || empty($data['email'])    ||
        empty($data['mobile'])       || empty($data['doctor_name']) ||
        empty($data['appointment_date']) || empty($data['appointment_time'])) {
        return "All fields are required";
    }
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        return "Invalid email format";
    }
    if (strlen($data['mobile']) != 10) {
        return "Mobile number must be 10 digits";
    }
    if ($data['appointment_date'] < date("Y-m-d")) {
        return "Appointment date cannot be a past date";
    }
    return "";
}

// Helper: prepare or die with JSON error
function safePrep($conn, $sql) {
    $stmt = mysqli_prepare($conn, $sql);
    if (!$stmt) {
        echo json_encode(["success" => false, "message" => "DB prepare error: " . mysqli_error($conn)]);
        exit;
    }
    return $stmt;
}

// POST – Create appointment
if ($method === "POST") {
    $error = validateInput($data);
    if ($error) {
        echo json_encode(["success" => false, "message" => $error]);
        exit;
    }

    // Double booking check
    $stmt = safePrep($conn, "SELECT id FROM appointments
                              WHERE doctor_name=? AND appointment_date=? AND appointment_time=?");
    mysqli_stmt_bind_param($stmt, "sss", $data['doctor_name'], $data['appointment_date'], $data['appointment_time']);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);
    if (mysqli_stmt_num_rows($stmt) > 0) {
        echo json_encode(["success" => false, "message" => "This slot is already booked"]);
        exit;
    }
    mysqli_stmt_close($stmt);

    // Daily limit check (max 20 per doctor)
    $stmt = safePrep($conn, "SELECT COUNT(*) FROM appointments
                              WHERE doctor_name=? AND appointment_date=?");
    mysqli_stmt_bind_param($stmt, "ss", $data['doctor_name'], $data['appointment_date']);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_bind_result($stmt, $total);
    mysqli_stmt_fetch($stmt);
    mysqli_stmt_close($stmt);
    if ($total >= 20) {
        echo json_encode(["success" => false, "message" => "Daily limit (20) reached for this doctor"]);
        exit;
    }

    // Insert
    $stmt = safePrep($conn, "INSERT INTO appointments
                (patient_name, email, mobile, doctor_name, appointment_date, appointment_time)
                VALUES (?,?,?,?,?,?)");
    mysqli_stmt_bind_param($stmt, "ssssss",
        $data['patient_name'], $data['email'], $data['mobile'],
        $data['doctor_name'],  $data['appointment_date'], $data['appointment_time']);

    $msg = mysqli_stmt_execute($stmt)
         ? ["success" => true,  "message" => "Appointment Created Successfully"]
         : ["success" => false, "message" => "Database Error: " . mysqli_error($conn)];
    echo json_encode($msg);
    exit;
}

// PUT – Update status only OR full update
if ($method === "PUT") {

    // Status-only update (from dropdown)
    if (isset($data['status']) && !isset($data['patient_name'])) {
        if (empty($data['id'])) {
            echo json_encode(["success" => false, "message" => "ID required"]);
            exit;
        }
        $allowed = ["Pending", "Confirmed", "Cancelled"];
        if (!in_array($data['status'], $allowed)) {
            echo json_encode(["success" => false, "message" => "Invalid status value"]);
            exit;
        }
        $stmt = safePrep($conn, "UPDATE appointments SET status=? WHERE id=?");
        mysqli_stmt_bind_param($stmt, "si", $data['status'], $data['id']);
        mysqli_stmt_execute($stmt);
        echo json_encode(["success" => true, "message" => "Status Updated"]);
        exit;
    }

    // Full update (from edit form)
    $error = validateInput($data);
    if ($error) {
        echo json_encode(["success" => false, "message" => $error]);
        exit;
    }
    if (empty($data['id'])) {
        echo json_encode(["success" => false, "message" => "ID required for update"]);
        exit;
    }
    $stmt = safePrep($conn, "UPDATE appointments
                SET patient_name=?, email=?, mobile=?, doctor_name=?,
                    appointment_date=?, appointment_time=?
                WHERE id=?");
    mysqli_stmt_bind_param($stmt, "ssssssi",
        $data['patient_name'], $data['email'], $data['mobile'],
        $data['doctor_name'],  $data['appointment_date'], $data['appointment_time'],
        $data['id']);

    $msg = mysqli_stmt_execute($stmt)
         ? ["success" => true,  "message" => "Appointment Updated Successfully"]
         : ["success" => false, "message" => "Database Error: " . mysqli_error($conn)];
    echo json_encode($msg);
    exit;
}

// DELETE – Remove appointment
if ($method === "DELETE") {
    if (empty($data['id'])) {
        echo json_encode(["success" => false, "message" => "ID required"]);
        exit;
    }
    $stmt = safePrep($conn, "DELETE FROM appointments WHERE id=?");
    mysqli_stmt_bind_param($stmt, "i", $data['id']);

    if (mysqli_stmt_execute($stmt)) {
        $msg = mysqli_stmt_affected_rows($stmt) > 0
             ? ["success" => true,  "message" => "Appointment Deleted Successfully"]
             : ["success" => false, "message" => "Appointment not found"];
    } else {
        $msg = ["success" => false, "message" => "Database Error: " . mysqli_error($conn)];
    }
    echo json_encode($msg);
    exit;
}

// Fallback
echo json_encode(["success" => false, "message" => "Method not supported"]);
