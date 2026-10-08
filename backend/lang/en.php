<?php
// Server messages in English, read by t_server() (config/api_helpers.php).
// Same keys as it.php and same {placeholders}: checked by `npm run i18n:check`.
return array(
    'auth.unauthenticated' => 'Unauthorized. Please log in.',
    'auth.missing_credentials' => 'Username and password are required.',
    'auth.too_many_logins' => 'Too many login attempts. Try again in {seconds} seconds.',
    'auth.invalid_credentials' => 'Invalid username or password.',
    'auth.login_ok' => 'Login successful.',
    'auth.login_error' => 'An error occurred during login.',
    'auth.logout_ok' => 'Logged out successfully.',
    'auth.logout_error' => 'An error occurred during logout.',
    'auth.token_missing' => 'Missing token.',

    'common.email_invalid' => 'Enter a valid email address.',
    'common.too_many_later' => 'Too many attempts. Try again later.',
    'common.error_retry' => 'Something went wrong. Please try again.',

    'password.min_length' => 'Password must be at least 8 characters long.',
    'password.max_length' => 'Password cannot be longer than 72 characters.',
    'password.uppercase' => 'Password must contain at least one uppercase letter.',
    'password.lowercase' => 'Password must contain at least one lowercase letter.',
    'password.number' => 'Password must contain at least one number.',
    'password.special' => 'Password must contain at least one special character (!@#$%^&*).',

    'birth.invalid' => 'Date of birth is missing or invalid.',
    'birth.too_young' => 'You must be at least 14 years old to use LiftIndex.',
    'training_start.invalid' => 'Training start date is not valid.',
    'exercise.params_invalid' => 'Sets (1-20), reps (max 20 characters) and rest (0-3600 seconds) are not valid.',

    'register.too_many' => 'Too many sign-ups from this address. Try again in {seconds} seconds.',
    'register.username_invalid' => 'Username can only contain letters and numbers (3 to 50 characters).',
    'register.gender_required' => 'Select your sex.',
    'register.terms_required' => 'To sign up you must accept the terms of use and the privacy policy.',
    'register.ok' => 'Account created successfully.',
    'register.failed' => 'Could not create the account. The username or email may already be in use.',
    'register.incomplete' => 'Missing data. Username, email and password are required.',
    'register.error' => 'An error occurred during sign-up.',

    'forgot.sent' => "If the address is registered, we've sent you an email with instructions to reset your password.",
    'forgot.too_many' => 'Too many requests. Try again later.',
    'forgot.email_subject' => 'Reset your password',
    'forgot.email_body' => "Hi {username},\n\n"
        . "we received a request to reset the password for your account.\n"
        . "Open this link within 1 hour:\n\n{link}\n\n"
        . "If you didn't request this, ignore this email: your password won't change.\n",

    'reset.missing' => 'Token and new password are required.',
    'reset.ok' => 'Password reset. You can now log in.',
    'reset.invalid_link' => 'The link is invalid or has expired. Request a new one.',

    'change_password.missing' => 'Current password and new password are required.',
    'change_password.same' => 'The new password must be different from the current one.',
    'change_password.ok' => 'Password changed successfully.',
    'change_password.wrong_current' => 'The current password is incorrect.',
    'change_password.error' => 'An error occurred while changing the password.',

    'common.method_not_allowed' => 'Method not allowed.',
    'common.invalid_request' => 'Invalid request.',
    'common.missing_data' => 'Missing data.',
    'common.server_error' => 'Internal server error.',
    'settings.no_fields' => 'Nothing to update.',
    'settings.updated' => 'Profile updated successfully.',
    'settings.locale_invalid' => 'Language not supported.',
    'settings.update_error' => 'Error while updating settings.',
    'account.password_required' => 'Password is required.',
    'account.deleted' => 'Account deleted successfully.',
    'account.wrong_password' => 'Incorrect password. The account cannot be deleted.',
    'consent.not_revocable' => 'This consent cannot be withdrawn: delete your account to withdraw it.',
    'consent.error' => 'Error while performing the operation.',
);
