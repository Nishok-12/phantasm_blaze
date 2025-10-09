<?php
// require 'vendor/autoload.php'; if using Composer
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Load the PHPMailer files
require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/src/Exception.php';
require_once __DIR__ . '/PHPMailer/src/SMTP.php';

// Check if the request method is POST
if ($_SERVER["REQUEST_METHOD"] == "POST") {

    // Get the raw POST data
    $json_data = file_get_contents("php://input");
    $data = json_decode($json_data, true);

    // Check if data is valid and required fields are present
    if (empty($data) || !isset($data['to']) || !isset($data['subject']) || !isset($data['body'])) {
        http_response_code(400); // Bad Request
        echo json_encode(['status' => 'error', 'message' => 'Invalid or missing data.']);
        exit;
    }

    $to_email = $data['to'];
    $subject = $data['subject'];
    $html_body = $data['body'];

    $mail = new PHPMailer(true);

    try {
        // Server settings
        $mail->isSMTP();
        $mail->Host       = 'your_smtp_host'; // e.g., 'smtp.gmail.com'
        $mail->SMTPAuth   = true;
        $mail->Username   = 'your_smtp_username';
        $mail->Password   = 'your_smtp_password';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS; // or ENCRYPTION_SMTPS for SSL
        $mail->Port       = 587; // or 465 for SSL

        // Recipients
        $mail->setFrom('phantasmblaze26@gmail.com', 'Phantasm Blaze Team');
        $mail->addAddress($to_email);

        // Content
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $html_body;
        $mail->CharSet = 'UTF-8';

        $mail->send();
        
        http_response_code(200);
        echo json_encode(['status' => 'success', 'message' => 'Email sent successfully.']);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => "Message could not be sent. Mailer Error: {$mail->ErrorInfo}"]);
    }

} else {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['status' => 'error', 'message' => 'Only POST requests are allowed.']);
}
?>