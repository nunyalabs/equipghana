# User Setup & Sharing Feature Guide

## Overview
Administrators can now securely share user credentials and setup configurations with new users via encrypted packages. This enables offline user onboarding and configuration updates without manual data entry.

## Features

### 1. Admin Creates User Setup Package
- **Who**: Administrators only
- **What**: Generate an encrypted `.equipsetup.json` file containing:
  - User credentials (username + temporary password)
  - Role and permissions
  - Assigned registers (forms)
  - CSO assignments
  - Scope configuration

### 2. User First-Time Setup
- **Who**: New users
- **What**: Import the setup package to:
  - Create their user profile
  - Install assigned registers
  - Login with temporary password
  - **Required**: Change password on first login

### 3. Admin Shares Updates
- **Who**: Administrators
- **What**: Send updated configurations to existing users:
  - New or updated registers
  - Changed permissions
  - Updated CSO assignments
  - **Important**: User's existing data is never deleted

### 4. User Merges Updates
- **Who**: Existing users
- **What**: Import update packages to:
  - Receive new registers
  - Update permissions
  - Preserve all collected data records

## How to Use

### For Administrators: Creating a User Setup Package

1. **Create or Edit a User**:
   - Go to "Users & Roles" tab
   - Create a new user or edit an existing one
   - Assign role, scope, registers, and CSOs

2. **Export Setup Package**:
   - Click the **"Share Setup"** button next to the user
   - Enter a strong passphrase (you'll share this separately)
   - System generates a temporary password
   - Download the `.equipsetup.json` file

3. **Share with User** (3 items):
   - Send the `.equipsetup.json` file (via email, USB, etc.)
   - Share the passphrase (via SMS, phone call, or secure channel)
   - Share the temporary password (displayed in the alert)

### For Users: First-Time Setup

1. **Import the Setup Package**:
   - Open the EQUIP application
   - Click "Import Encrypted Backup" on the login screen or data sharing tab
   - Select the `.equipsetup.json` file
   - Enter the passphrase provided by your administrator

2. **Login**:
   - Username: (provided by admin)
   - Password: (temporary password from admin)

3. **Change Password**:
   - System will immediately prompt you to create a new password
   - Enter a strong password (min 6 characters)
   - Confirm the password
   - Your account is now active!

4. **Start Using the System**:
   - All assigned registers are now available
   - Begin data entry and reporting

### For Users: Importing Updates

1. **Receive Update Package**:
   - Administrator sends you an updated `.equipsetup.json` file
   - You also receive a new passphrase

2. **Import the Update**:
   - Go to "Data Sharing" tab
   - Click "Import Encrypted Backup"
   - Select the file and enter the passphrase
   - Confirm you want to merge the updates

3. **What Happens**:
   - New registers are added
   - Permissions are updated
   - **Your existing data is preserved**
   - System reloads with new configuration

## Security Features

1. **Strong Encryption**:
   - AES-256-GCM encryption
   - PBKDF2 key derivation (120,000 iterations)
   - Unique salt and IV for each package

2. **Temporary Passwords**:
   - Random 12-character passwords
   - Must be changed on first login
   - Old password cannot be reused

3. **Passphrase Protection**:
   - Decrypt-only with correct passphrase
   - Shared separately from the file
   - No password recovery (if lost, admin re-exports)

## Best Practices

### For Administrators:
1. **Strong Passphrases**: Use at least 12 characters, mix letters/numbers/symbols
2. **Separate Channels**: Send file and passphrase via different methods
3. **Verify Receipt**: Confirm user received all 3 items before they attempt login
4. **Regular Updates**: When registers change, share update packages with affected users
5. **Document Sharing**: Keep a log of when packages were shared and with whom

### For Users:
1. **Secure Storage**: Keep the passphrase safe (password manager recommended)
2. **Immediate Password Change**: Change temporary password as soon as you login
3. **Strong Passwords**: Use unique, complex passwords (8+ characters)
4. **Backup Before Updates**: Export your own backup before importing admin updates
5. **Verify Source**: Only import packages from trusted administrators

## Troubleshooting

### "Decryption failed"
- **Cause**: Wrong passphrase or corrupted file
- **Solution**: Re-enter passphrase carefully, or request a new package from admin

### "User already exists"
- **Cause**: You're importing a setup package for a user that's already on your device
- **Solution**: System will offer to merge updates. Accept if this is an intentional update.

### "Password must be at least 6 characters"
- **Cause**: New password is too short
- **Solution**: Choose a longer, stronger password

### Setup package won't import
- **Cause**: File may be corrupted or incomplete
- **Solution**: Re-download the file or request admin to re-export

## Example Workflow

### Scenario: Onboarding a New Regional Manager

1. **Admin (Day 1)**:
   - Creates user: `john_regional`
   - Role: Regional Manager
   - Scope: Region = Greater Accra
   - Assigns: PrEP Register, HTC Register
   - Clicks "Share Setup"
   - Gets temporary password: `xY7mNp3qRzW9`
   - Emails `.equipsetup.json` file
   - Calls John and shares passphrase: `SecurePhrase2025!`
   - Texts temporary password

2. **John (Day 1)**:
   - Opens EQUIP app on laptop
   - Clicks "Import Encrypted Backup"
   - Selects the file, enters passphrase
   - Logs in with `john_regional` / `xY7mNp3qRzW9`
   - System prompts: "Change your password"
   - Enters new password: `JohnSecure!2025`
   - Sees dashboard with 2 registers assigned
   - Begins work

3. **Admin (Day 30)**:
   - Creates new "CT Register"
   - Wants John to have access
   - Edits John's profile, adds CT Register
   - Clicks "Share Setup" again
   - Sends new `.equipsetup.json` update package

4. **John (Day 30)**:
   - Imports the update package
   - Confirms merge
   - Now sees 3 registers (PrEP, HTC, CT)
   - All his previous data records intact

## Technical Notes

### File Format
- Extension: `.equipsetup.json`
- Module identifier: `EQUIP_USER_SETUP`
- Includes metadata: target user, export date, administrator

### Data Merge Logic
- **Users**: Skips if username exists (unless explicit update)
- **Forms**: Adds new, skips duplicates by ID and name
- **Records**: Never deleted, only added
- **Roles**: Merged if not present

### Permissions Required
- **Export Setup**: `canManageUsers` permission
- **Import Setup**: No login required for first-time; must be logged in for updates

## Support

If you encounter issues:
1. Check this guide for troubleshooting steps
2. Contact your system administrator
3. For technical support, provide:
   - Error message (exact text)
   - Steps you took before the error
   - Whether this is first-time setup or an update

---

**Document Version**: 1.0  
**Last Updated**: October 4, 2025  
**System**: EQUIP Health Ghana Registers PWA
