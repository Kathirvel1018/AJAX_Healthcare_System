<?php

// ─────────────────────────────────────────────
//  config.php  –  Database Connection
//  Project : CapMinds AJAX Healthcare Task
//  Author  : Kathirvel
// ─────────────────────────────────────────────

// Database credentials
define('DB_HOST', 'localhost');
define('DB_USER', 'root');        // Change if your DB user is different
define('DB_PASS', '');            // Add your MySQL password here
define('DB_NAME', 'clinic_db');

// Disable strict mysqli exception mode (default ON in PHP 8.1+)
// Without this, any mysqli error throws an uncaught exception → empty response
mysqli_report(MYSQLI_REPORT_OFF);

// Create MySQLi connection
$conn = mysqli_connect(DB_HOST, DB_USER, DB_PASS, DB_NAME);

// Check connection – stop everything if it fails
if (!$conn) {
    header("Content-Type: application/json");
    echo json_encode([
        "success" => false,
        "message" => "Database connection failed: " . mysqli_connect_error()
    ]);
    exit;
}

// Set character encoding to UTF-8 (best practice)
mysqli_set_charset($conn, "utf8mb4");

// $conn is now ready to use in api.php