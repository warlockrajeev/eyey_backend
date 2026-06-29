import admin from "firebase-admin";

// In a real production app, you should use a service account JSON file.
// For this implementation, we'll initialize with minimal config and use environment variables for verification if possible,
// or expect the project ID.
// IMPORTANT: To verify ID tokens, you need the project ID.

const firebaseAdminConfig = {
    projectId: "eyey-e4d56",
};

if (!admin.apps.length) {
    admin.initializeApp(firebaseAdminConfig);
}

export default admin;
