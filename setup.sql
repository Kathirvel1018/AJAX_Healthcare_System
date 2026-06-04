-- Run this in phpMyAdmin or MySQL CLI to set up the database

CREATE DATABASE IF NOT EXISTS clinic_db;
USE clinic_db;

CREATE TABLE IF NOT EXISTS appointments (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    patient_name     VARCHAR(100)  NOT NULL,
    email            VARCHAR(100)  NOT NULL,
    mobile           VARCHAR(15)   NOT NULL,
    doctor_name      VARCHAR(100)  NOT NULL,
    appointment_date DATE          NOT NULL,
    appointment_time TIME          NOT NULL,
    status           ENUM('Pending','Confirmed','Cancelled') DEFAULT 'Pending',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
