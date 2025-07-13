**Module: Notifications (OneSignal Integration)**

**REQ-NOTIF-001**

- **Requirement Type:** Functional, Integration
- **Description:** The system MUST integrate with OneSignal for sending push notifications to client (Flutter) applications and potentially web notifications for team members using a web interface (if applicable in the future).
- **Rationale:** Provides a mechanism for real-time alerting of users about important events.
- **Acceptance Criteria:**
  - OneSignal SDK is integrated into the Flutter client application.
  - Backend server is configured to use the OneSignal REST API (App ID, REST API Key).
  - Client application successfully registers devices with OneSignal and obtains a OneSignal Player ID.
-
- **Priority:** Must Have
- **Standard/Reference:** OneSignal Documentation

**REQ-NOTIF-002**

- **Requirement Type:** Data
- **Description:** The Users table (REQ-USER-001) MUST be extended to store the OneSignal Player ID associated with each user's active device(s). A user might have multiple devices, so this may require a separate UserDevicePlayerIDs table:
  - id (Primary Key)
  - user_id (FK to Users, NOT NULL)
  - player_id (VARCHAR, OneSignal Player ID, Unique, Indexed)
  - device_type (Enum: 'IOS', 'ANDROID', 'WEB', etc.)
  - last_seen_at (Timestamp)
  - is_active (Boolean, default: true)
-
- **Rationale:** Allows the backend to target notifications to specific users via their OneSignal Player IDs.
- **Acceptance Criteria:**
  - Database schema includes UserDevicePlayerIDs (or similar structure on Users if only one active device per user is assumed initially).
  - Client application, upon successful login and OneSignal registration, sends the Player ID to the backend to be stored against the user's record. An API endpoint (POST /users/me/devices) must exist for this.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling

**REQ-NOTIF-003**

- **Requirement Type:** Functional, Server-Side Logic
- **Description:** The backend system MUST trigger push notifications via OneSignal for the following critical events related to TaskInstances:
  - **To Client:**
    - When a task assigned to them transitions to OPEN.
    - When a task they submitted is RETURNED_TO_CLIENT (includes reason/feedback summary).
    - When a petition they own is COMPILED.
    - When a petition they own has a PetitionInstanceFilingProgress step updated.
    - When a new comment is added by a team member to one of their tasks.
  -
  - **To Assigned Team Member (NN/Vendor Employee/Manager):**
    - When a task is assigned to them and becomes OPEN or PENDING_REVIEW.
    - When a task assigned to them is approaching its due_date (e.g., 24 hours before).
    - When a client adds a comment to a task assigned to them.
  -
  - **To Team Manager (if applicable, for unassigned team tasks):**
    - When a task assigned to their team (but not a specific user) becomes OPEN or PENDING_REVIEW.
  -
-
- **Rationale:** Keeps users informed about actions requiring their attention or important status changes.
- **Acceptance Criteria:**
  - Backend logic correctly identifies target users (and their Player IDs) for each event.
  - Notifications are successfully sent via OneSignal API for all specified events.
  - Notification content is clear, concise, and relevant to the event.
  - Notifications include deep-linking information (e.g., petition_instance_id, task_instance_id) to allow the client app to navigate to the relevant screen upon opening the notification.
-
- **Priority:** Must Have
- **Standard/Reference:** \-

**REQ-NOTIF-004**

- **Requirement Type:** Functional
- **Description:** Notification message templates MUST be stored as ContentBlocks records (e.g., content_type \= 'PLAIN_TEXT_TEMPLATE' or 'HTML_EMAIL_TEMPLATE'). These templates can include placeholders (e.g., {{taskName}}, {{clientName}}) that the backend populates with dynamic data before sending the notification. This allows for easier management, updating, and future localization of notification content.
- **Rationale:** Standardizes template management using ContentBlocks for consistency.
- **Acceptance Criteria:**
  - Notification message templates are stored as ContentBlocks.
  - Backend system retrieves these templates, populates placeholders, and uses the result for OneSignal payloads.
-
- **Priority:** Should Have
- **Standard/Reference:** Content Management

**REQ-NOTIF-005**

- **Requirement Type:** Functional, Client-Side Logic
- **Description:** The client application (Flutter) MUST correctly handle received push notifications:
  - Display the notification to the user (system tray).
  - When a user taps on a notification, the app MUST navigate to the relevant context (e.g., specific task screen, petition dashboard) based on data included in the notification payload.
  - Optionally, update in-app badges or indicators based on unread notifications.
-
- **Rationale:** Ensures notifications are actionable and provide a good user experience.
- **Acceptance Criteria:**
  - Client app displays notifications.
  - Deep-linking from notifications to specific app sections functions correctly.
-
- **Priority:** Must Have
- **Standard/Reference:** Mobile App UX Best Practices

**REQ-NOTIF-006**

- **Requirement Type:** Functional
- **Description:** Users (Clients and Team Members) MUST have settings within the application to manage their notification preferences (e.g., enable/disable certain types of notifications), where legally permissible and practical.
- **Rationale:** Gives users control over the notifications they receive, improving user satisfaction.
- **Acceptance Criteria:**
  - User profile includes settings for notification preferences.
  - Backend respects these preferences when deciding whether to send a notification to a user (by not sending or by using OneSignal segments/tags if user has opted out of specific types).
-
- **Priority:** Should Have
- **Standard/Reference:** User Preferences Management

**REQ-NOTIF-007**

- **Requirement Type:** Security
- **Description:** OneSignal REST API Key and App ID MUST be stored securely on the backend (e.g., environment variables, secrets manager) and not exposed in client-side code or logs.
- **Rationale:** Protects OneSignal credentials from unauthorized use.
- **Acceptance Criteria:**
  - OneSignal credentials are not hardcoded or accessible from the client.
  - Secure storage mechanisms are used for these credentials on the server.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A05:2021-Security Misconfiguration

**REQ-NOTIF-008**

- **Requirement Type:** Auditing
- **Description:** The sending of critical notifications (or at least the attempt to send) SHOULD be logged for troubleshooting purposes. Logs could include: Timestamp, Target User ID, Event Type, Notification Content Summary, OneSignal Send Status (Success/Failure).
- **Rationale:** Aids in diagnosing notification delivery issues.
- **Acceptance Criteria:**
  - Attempts to send key notifications are logged with relevant details.
-
- **Priority:** Should Have
- **Standard/Reference:** Logging Best Practices

**REQ-NOTIF-009: Notification Center & Persistent Storage**

- **Requirement Type:** Functional, Data, API, UI
- **Description:**
  - **Persistent Storage:** The system MUST store a persistent record of important notifications sent to users in a UserNotifications table. Each record MUST include:
    - id (Primary Key, UUID recommended)
    - user_id (UUID, FK to Users.id, NOT NULL, Indexed)
    - title (TEXT, Short title of the notification, NOT NULL)
    - message (TEXT, Full notification message, NOT NULL)
    - notification_type (Enum: 'TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'TASK_COMMENT_ADDED', 'TASK_REMINDER', 'PETITION_STATUS_CHANGED', 'FILING_UPDATE', 'GENERAL_ALERT', 'ADDON_CONFIRMATION', 'UPGRADE_CONFIRMATION', NOT NULL)
    - read_status (Boolean, default: false, NOT NULL, Indexed)
    - deep_link_target_type (Enum: 'PETITION', 'TASK', 'COMMENT_THREAD', 'FILING_STEP', Nullable) \- Entity type for deep-linking.
    - deep_link_target_id (UUID, Nullable) \- ID of the entity for deep-linking.
    - related_entity_type (Enum: 'PETITION_INSTANCE', 'TASK_INSTANCE', etc., Nullable) \- Broader context.
    - related_entity_id (UUID, Nullable) \- ID of the broader context entity.
    - created_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
  -
  - **Creation:** When a server-side event triggers a push notification (as per REQ-NOTIF-003), if the event is deemed significant for persistent history (e.g., not just transient reminders unless desired), a corresponding record MUST also be created in UserNotifications for each target user.
  - **Notification Center UI:** The client application MUST provide a "Notification Center" screen (as per mockup). This screen MUST:
    - Display a list of the user's notifications retrieved from UserNotifications, ordered by created_at descending.
    - Visually differentiate between read and unread notifications.
    - Allow filtering by "All" and "Unread".
    - Implement "Mark all as read" functionality.
    - Allow tapping on a notification to mark it as read and, if deep_link_target_type and deep_link_target_id are present, navigate the user to the relevant in-app screen/entity .
  -
  - **API Endpoints:**
    - GET /users/me/notifications: Retrieve user's notifications. Supports pagination and filtering by read_status.
    - PATCH /users/me/notifications/{notificationId}/mark-read: Mark a specific notification as read.
    - POST /users/me/notifications/mark-all-read: Mark all unread notifications for the user as read.
  -
-
- **Rationale:** Provides a persistent, in-app history of important notifications, ensuring users don't miss critical updates even if they dismiss push alerts. Supports the "Notification Center Screen" mockup.
- **Acceptance Criteria:**
  - UserNotifications table schema exists with specified fields and enums.
  - Persistent notifications are created in UserNotifications for designated important events that also trigger push notifications.
  - Client UI for Notification Center displays notifications, supports filtering, mark as read (single/all), and deep-linking.
  - API endpoints for retrieving and managing read status exist, function correctly, are authorized, and documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** User Experience Best Practices, Mobile App Design Patterns, OAS 3.x
