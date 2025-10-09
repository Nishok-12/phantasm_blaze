<?php
// Note: You must run 'composer require phpmailer/phpmailer' on your PHP server to use this.
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

// --- CRITICAL CONFIGURATION: Retrieve credentials from environment ---
// These variables must be set in your server's environment (e.g., Render Environment Variables)
$smtpUser = getenv('EMAIL_USER');
$smtpPass = getenv('EMAIL_PASS');

// Set static configuration based on Gmail
const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587; // Use 587 with ENCRYPTION_STARTTLS

// Load Composer's autoloader (Adjust path if necessary)
require_once __DIR__ . '/vendor/autoload.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Allows Node.js app access

// 1. Basic Request Validation
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
    exit;
}

// 2. Check Environment Credentials
if (!$smtpUser || !$smtpPass) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Email credentials (EMAIL_USER or EMAIL_PASS) are missing from the environment.']);
    exit;
}

// Get JSON data from the request body
$json_data = file_get_contents("php://input");
$data = json_decode($json_data, true);

// 3. Data Validation
if (empty($data) || !isset($data['to']) || !isset($data['subject']) || !isset($data['html'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid or missing JSON data in request body.']);
    exit;
}

$to_email = filter_var($data['to'], FILTER_VALIDATE_EMAIL);
$subject = filter_var($data['subject'], FILTER_SANITIZE_STRING);
$html_body = $data['html'];
$from_name = $data['from_name'] ?? 'Phantasm Blaze Team';

if (!$to_email) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid recipient email address.']);
    exit;
}

$mail = new PHPMailer(true);

try {
    // Enable debugging (Set to 0 in production)
    $mail->SMTPDebug  = 0; // Set to 2 for verbose output when debugging
    $mail->isSMTP();
    
    // Set SMTP configuration using environment variables
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = $smtpUser; // From environment
    $mail->Password   = $smtpPass; // From environment (MUST be App Password)
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS; 
    $mail->Port       = SMTP_PORT; 

    // Recipients
    $mail->setFrom($smtpUser, $from_name);
    $mail->addAddress($to_email);

    // Content
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $html_body;
    $mail->AltBody = strip_tags($html_body); // Plain text fallback
    $mail->CharSet = 'UTF-8';

    // Attempt to send
    $mail->send();
    
    http_response_code(200);
    echo json_encode(['status' => 'success', 'message' => 'Email sent via PHP endpoint.']);

} catch (Exception $e) {
    // Log the detailed error info and return a generic error
    error_log("PHPMailer Error to {$to_email}: {$mail->ErrorInfo}");
    
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => "Email failed. Mailer Error: {$mail->ErrorInfo}"]);
}
?>
